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

/**
 * Tickets have no per-user visibility restriction (any authenticated user
 * can see any ticket, CONTRACT.md §1.4/§9.5), so these broadcast org-wide
 * via `io.emit` — same precedent `presence:update` already established
 * (CONTRACT.md §9.6), rather than a per-user/per-channel room.
 */
export function broadcastTicketCreated(io: Server, ticket: unknown): void {
  io.emit('ticket:created', { ticket });
}

export function broadcastTicketUpdated(io: Server, ticket: unknown): void {
  io.emit('ticket:updated', { ticket });
}

export function broadcastTicketDeleted(io: Server, ticketId: string): void {
  io.emit('ticket:deleted', { ticketId });
}

/**
 * AI RAG code assistant (Module 7) events. Unlike the helpers above, these
 * are emitted directly by services/ai/aiQuery.service.ts's injected `emit`
 * callback and services/ai/aiMention.service.ts (both target
 * `channel:{id}`/`user:{id}` rooms themselves), and by controllers/ai.controller.ts
 * for `ai:index:progress` — these two wrappers exist mainly for payload-shape
 * documentation/reuse, not because every caller goes through them.
 */
export function broadcastAiIndexProgress(
  io: Server,
  userId: string,
  progress: { runId: string; status: string; filesProcessed: number; totalFiles: number; chunkCount: number },
): void {
  io.to(`user:${userId}`).emit('ai:index:progress', progress);
}
