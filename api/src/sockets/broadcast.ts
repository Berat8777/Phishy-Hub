import { Server } from 'socket.io';
import type { MessageDTO } from '../services/message.service';

/**
 * Centralized emit helpers so the REST layer (message.controller.ts) and
 * the socket layer (handlers/message.handler.ts) broadcast the exact same
 * event names/payload shapes — see architecture doc §4 "mesaj yaratma
 * tekilleştirmesi". Deliberately takes `io` as a parameter rather than
 * importing sockets/index's getIo() here, so this module has no import-time
 * dependency on the sockets bootstrap (avoids a require() cycle with
 * services/message.service.ts, which callers on both sides also import).
 */

export function broadcastNewMessage(io: Server, message: MessageDTO, tempId?: string): void {
  io.to(`channel:${message.channelId}`).emit('message:new', tempId ? { message, tempId } : { message });
}

export function broadcastMessageUpdated(io: Server, message: MessageDTO): void {
  io.to(`channel:${message.channelId}`).emit('message:updated', { message });
}

export function broadcastMessageDeleted(io: Server, channelId: string, messageId: string): void {
  io.to(`channel:${channelId}`).emit('message:deleted', { messageId, channelId });
}

export function broadcastMessageRead(
  io: Server,
  payload: { channelId: string; userId: string; lastReadMessageId: string; readAt: string },
): void {
  io.to(`channel:${payload.channelId}`).emit('message:read', payload);
}

export function broadcastNotification(io: Server, userId: string, notification: unknown): void {
  io.to(`user:${userId}`).emit('notification:new', { notification });
}

export function broadcastReactionAdded(
  io: Server,
  payload: { channelId: string; messageId: string; emoji: string; userId: string },
): void {
  io.to(`channel:${payload.channelId}`).emit('reaction:added', {
    messageId: payload.messageId,
    emoji: payload.emoji,
    userId: payload.userId,
  });
}

export function broadcastReactionRemoved(
  io: Server,
  payload: { channelId: string; messageId: string; emoji: string; userId: string },
): void {
  io.to(`channel:${payload.channelId}`).emit('reaction:removed', {
    messageId: payload.messageId,
    emoji: payload.emoji,
    userId: payload.userId,
  });
}
