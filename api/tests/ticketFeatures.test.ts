import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { io as ioClient, Socket } from 'socket.io-client';
import { buildApp } from './helpers/testServer';
import { startTestServer, type TestSocketServer } from './helpers/testServer';
import { registerAndLogin, bearer, uniqueEmail } from './helpers/factories';
import type { AuthedSession } from './helpers/factories';

describe('ticket comments / search / unassigned filter / realtime', () => {
  let app: Express;
  let creator: AuthedSession;
  let assignee: AuthedSession;
  let outsider: AuthedSession;

  beforeAll(async () => {
    app = buildApp();
    creator = await registerAndLogin(app);
    assignee = await registerAndLogin(app);
    outsider = await registerAndLogin(app);
  });

  describe('q search (previously silently ignored)', () => {
    it('GET /tickets?q= matches title/description via ILIKE', async () => {
      const needle = uniqueEmail('printer-jam');
      await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', bearer(creator.accessToken))
        .send({ title: `Broken printer ${needle}`, description: 'paper jam' });
      await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', bearer(creator.accessToken))
        .send({ title: 'Unrelated ticket', description: 'nothing to do with it' });

      const res = await request(app)
        .get(`/api/v1/tickets?q=${needle}`)
        .set('Authorization', bearer(creator.accessToken));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const ticket of res.body.data) {
        expect(ticket.title.toLowerCase()).toContain(needle.toLowerCase());
      }
    });
  });

  describe('assignedToId=none', () => {
    it('filters to only unassigned tickets', async () => {
      const unassigned = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', bearer(creator.accessToken))
        .send({ title: `Unassigned-${uniqueEmail('t')}` });
      const assignedRes = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', bearer(creator.accessToken))
        .send({ title: `Assigned-${uniqueEmail('t')}` });
      await request(app)
        .post(`/api/v1/tickets/${assignedRes.body.data.id}/assign`)
        .set('Authorization', bearer(creator.accessToken))
        .send({ assignedToId: assignee.userId });

      const res = await request(app)
        .get('/api/v1/tickets?assignedToId=none&pageSize=100')
        .set('Authorization', bearer(creator.accessToken));
      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(unassigned.body.data.id);
      expect(ids).not.toContain(assignedRes.body.data.id);
      for (const ticket of res.body.data) {
        expect(ticket.assignedToId).toBeNull();
      }
    });

    it('a malformed assignedToId that is not "none" and not a UUID -> 422', async () => {
      const res = await request(app)
        .get('/api/v1/tickets?assignedToId=not-a-uuid')
        .set('Authorization', bearer(creator.accessToken));
      expect(res.status).toBe(422);
    });
  });

  describe('comments', () => {
    it('any authenticated user can comment; author or admin can edit/delete; creator+assignee get notified (not the comment author)', async () => {
      const createRes = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', bearer(creator.accessToken))
        .send({ title: `Commentable-${uniqueEmail('t')}` });
      const ticketId = createRes.body.data.id;

      await request(app)
        .post(`/api/v1/tickets/${ticketId}/assign`)
        .set('Authorization', bearer(creator.accessToken))
        .send({ assignedToId: assignee.userId });

      const commentRes = await request(app)
        .post(`/api/v1/tickets/${ticketId}/comments`)
        .set('Authorization', bearer(outsider.accessToken))
        .send({ body: 'Any update on this?' });
      expect(commentRes.status).toBe(201);
      const commentId = commentRes.body.data.id;

      const listRes = await request(app)
        .get(`/api/v1/tickets/${ticketId}/comments`)
        .set('Authorization', bearer(creator.accessToken));
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.map((c: { id: string }) => c.id)).toContain(commentId);

      // Creator (not the comment author) got notified.
      const creatorNotifications = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', bearer(creator.accessToken));
      expect(
        creatorNotifications.body.data.some(
          (n: { type: string; payload: { commentId: string } }) =>
            n.type === 'ticket_comment_added' && n.payload.commentId === commentId,
        ),
      ).toBe(true);

      // Assignee (not the comment author) got notified.
      const assigneeNotifications = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', bearer(assignee.accessToken));
      expect(
        assigneeNotifications.body.data.some(
          (n: { type: string; payload: { commentId: string } }) =>
            n.type === 'ticket_comment_added' && n.payload.commentId === commentId,
        ),
      ).toBe(true);

      // A non-author, non-admin cannot edit/delete.
      const editByOther = await request(app)
        .patch(`/api/v1/tickets/${ticketId}/comments/${commentId}`)
        .set('Authorization', bearer(creator.accessToken))
        .send({ body: 'edited by someone else' });
      expect(editByOther.status).toBe(403);

      // The author can edit.
      const editByAuthor = await request(app)
        .patch(`/api/v1/tickets/${ticketId}/comments/${commentId}`)
        .set('Authorization', bearer(outsider.accessToken))
        .send({ body: 'edited by the author' });
      expect(editByAuthor.status).toBe(200);
      expect(editByAuthor.body.data.body).toBe('edited by the author');

      // The author can delete.
      const deleteByAuthor = await request(app)
        .delete(`/api/v1/tickets/${ticketId}/comments/${commentId}`)
        .set('Authorization', bearer(outsider.accessToken));
      expect(deleteByAuthor.status).toBe(200);
    });
  });
});

describe('ticket realtime broadcasts', () => {
  let server: TestSocketServer;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    while (openSockets.length) openSockets.pop()?.close();
    await server.close();
  });

  it('POST /tickets broadcasts ticket:created org-wide (io.emit, matching presence:update precedent)', async () => {
    const creator = await registerAndLogin(server.app);
    const listener = await registerAndLogin(server.app);

    const socket = ioClient(server.baseUrl, {
      auth: { token: listener.accessToken },
      forceNew: true,
      reconnection: false,
    });
    openSockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });

    const createdEvent = new Promise<{ ticket: { id: string; title: string } }>((resolve) => {
      socket.on('ticket:created', resolve);
    });

    const title = `Realtime-${uniqueEmail('t')}`;
    const createRes = await request(server.app)
      .post('/api/v1/tickets')
      .set('Authorization', bearer(creator.accessToken))
      .send({ title });
    expect(createRes.status).toBe(201);

    const event = await createdEvent;
    expect(event.ticket.id).toBe(createRes.body.data.id);
    expect(event.ticket.title).toBe(title);
  });
});
