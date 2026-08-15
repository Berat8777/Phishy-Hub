import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { io as ioClient, Socket } from 'socket.io-client';
import { startTestServer, type TestSocketServer } from './helpers/testServer';
import { registerAndLogin, bearer, uniqueEmail } from './helpers/factories';
import type { AuthedSession } from './helpers/factories';

/**
 * Real socket.io-client connections against a real listening server —
 * per CONTRACT.md §4.5, deliberately does NOT force `transports:
 * ['websocket']` (that combination was observed to silently drop the
 * second connection's packets when multiple sockets open in one Node
 * process; default polling->websocket upgrade negotiation avoids it).
 */
describe('socket.io', () => {
  let server: TestSocketServer;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(() => {
    while (openSockets.length) {
      const s = openSockets.pop();
      s?.close();
    }
  });

  function connect(token?: string): Socket {
    const socket = ioClient(server.baseUrl, {
      auth: token ? { token } : {},
      forceNew: true,
      reconnection: false,
    });
    openSockets.push(socket);
    return socket;
  }

  it('rejects a connection with no auth token', async () => {
    const socket = connect(undefined);
    const err = await new Promise<Error>((resolve) => {
      socket.on('connect_error', resolve);
      socket.on('connect', () => resolve(new Error('should not have connected')));
    });
    expect(socket.connected).toBe(false);
    expect(err).toBeTruthy();
  });

  it('accepts a connection with a valid access token', async () => {
    const session = await registerAndLogin(server.app);
    const socket = connect(session.accessToken);
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });
    expect(socket.connected).toBe(true);
  });

  it('channel:join is rejected for a channel the user is not a member of, accepted for one they are', async () => {
    const owner = await registerAndLogin(server.app);
    const outsider = await registerAndLogin(server.app);

    const createRes = await request(server.app)
      .post('/api/v1/channels')
      .set('Authorization', bearer(owner.accessToken))
      .send({ type: 'private', name: `socket-join-${uniqueEmail('c')}` });
    const channelId = createRes.body.data.id;

    const ownerSocket = connect(owner.accessToken);
    const outsiderSocket = connect(outsider.accessToken);
    await Promise.all([
      new Promise<void>((resolve) => ownerSocket.on('connect', () => resolve())),
      new Promise<void>((resolve) => outsiderSocket.on('connect', () => resolve())),
    ]);

    const outsiderAck = await new Promise<{ success: boolean; error?: { code: string } }>((resolve) => {
      outsiderSocket.emit('channel:join', { channelId }, resolve);
    });
    expect(outsiderAck.success).toBe(false);
    expect(outsiderAck.error?.code).toBe('FORBIDDEN');

    const ownerAck = await new Promise<{ success: boolean }>((resolve) => {
      ownerSocket.emit('channel:join', { channelId }, resolve);
    });
    expect(ownerAck.success).toBe(true);
  });

  it('a message sent by one client is broadcast to another member in the same channel as message:new', async () => {
    const userA = await registerAndLogin(server.app);
    const userB = await registerAndLogin(server.app);

    const createRes = await request(server.app)
      .post('/api/v1/channels')
      .set('Authorization', bearer(userA.accessToken))
      .send({ type: 'private', name: `socket-msg-${uniqueEmail('c')}`, memberIds: [userB.userId] });
    const channelId = createRes.body.data.id;

    // Both are DB members already, so both auto-join the channel room on connect.
    const socketA = connect(userA.accessToken);
    const socketB = connect(userB.accessToken);
    await Promise.all([
      new Promise<void>((resolve) => socketA.on('connect', () => resolve())),
      new Promise<void>((resolve) => socketB.on('connect', () => resolve())),
    ]);

    const received = new Promise<{ message: { body: string; channelId: string } }>((resolve) => {
      socketB.on('message:new', resolve);
    });

    const bodyText = `hello from A ${uniqueEmail('body')}`;
    const ack = await new Promise<{ success: boolean; data: { body: string } }>((resolve) => {
      socketA.emit('message:send', { channelId, body: bodyText }, resolve);
    });
    expect(ack.success).toBe(true);
    expect(ack.data.body).toBe(bodyText);

    const event = await received;
    expect(event.message.body).toBe(bodyText);
    expect(event.message.channelId).toBe(channelId);
  });

  it('typing:start reaches other members but not the sender (ack-less broadcast)', async () => {
    const userA = await registerAndLogin(server.app);
    const userB = await registerAndLogin(server.app);

    const createRes = await request(server.app)
      .post('/api/v1/channels')
      .set('Authorization', bearer(userA.accessToken))
      .send({ type: 'private', name: `socket-typing-${uniqueEmail('c')}`, memberIds: [userB.userId] });
    const channelId = createRes.body.data.id;

    const socketA = connect(userA.accessToken);
    const socketB = connect(userB.accessToken);
    await Promise.all([
      new Promise<void>((resolve) => socketA.on('connect', () => resolve())),
      new Promise<void>((resolve) => socketB.on('connect', () => resolve())),
    ]);

    let senderReceivedOwnTyping = false;
    socketA.on('typing', () => {
      senderReceivedOwnTyping = true;
    });
    const receivedByB = new Promise<{ channelId: string; userId: string; isTyping: boolean }>((resolve) => {
      socketB.on('typing', resolve);
    });

    socketA.emit('typing:start', { channelId });

    const event = await receivedByB;
    expect(event.channelId).toBe(channelId);
    expect(event.userId).toBe(userA.userId);
    expect(event.isTyping).toBe(true);
    expect(senderReceivedOwnTyping).toBe(false);
  });
});
