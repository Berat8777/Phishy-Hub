import { Server as HttpServer } from 'http';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { verifyAccessToken } from '../services/token.service';
import { UnauthorizedError } from '../utils/errors';
import { registerChannelHandlers } from './handlers/channel.handler';
import { registerMessageHandlers } from './handlers/message.handler';
import { registerTypingHandlers } from './handlers/typing.handler';
import { markUserOnline, markUserOffline } from './handlers/presence.handler';
import { ChannelMember } from '../models';
import type { AuthenticatedUser } from '../types/express';

/**
 * Socket.IO types `socket.data` via a generic parameter on `Socket<...>`
 * rather than a plain interface, so it can't be widened through normal
 * `declare module` augmentation (the generic default is `any`, and TS
 * rejects merging a concrete type onto a type-parameterized member). This
 * alias is what every handler should use instead of the bare `Socket` type.
 */
export type AppSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, { user: AuthenticatedUser }>;

let ioInstance: Server | null = null;

export function getIo(): Server {
  if (!ioInstance) {
    throw new Error('Socket.IO server accessed before initialization');
  }
  return ioInstance;
}

export function initSockets(httpServer: HttpServer): Server {
  const allowedOrigins = env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim());

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });
  ioInstance = io;

  // --- Auth middleware: every connection must present a valid access token. ---
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        throw new UnauthorizedError('Missing auth token');
      }
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.sub, role: payload.role as AuthenticatedUser['role'], orgId: payload.orgId };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    void handleConnection(io, socket as AppSocket);
  });

  return io;
}

async function handleConnection(io: Server, socket: AppSocket): Promise<void> {
  const { user } = socket.data;
  logger.info({ userId: user.id, socketId: socket.id }, 'socket connected');

  // Personal room — used for notification:new and other user-targeted events.
  await socket.join(`user:${user.id}`);

  // Auto-join every channel room the user is currently a member of.
  const memberships = await ChannelMember.findAll({ where: { userId: user.id }, attributes: ['channelId'] });
  for (const membership of memberships) {
    await socket.join(`channel:${membership.channelId}`);
  }

  markUserOnline(io, user.id, socket.id);

  registerChannelHandlers(io, socket);
  registerMessageHandlers(io, socket);
  registerTypingHandlers(io, socket);

  socket.on('disconnect', () => {
    logger.info({ userId: user.id, socketId: socket.id }, 'socket disconnected');
    markUserOffline(io, user.id, socket.id);
  });
}
