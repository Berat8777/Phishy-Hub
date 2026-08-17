/**
 * Typed Socket.IO event contract mirroring CONTRACT.md §4 exactly. Kept
 * separate from connection.ts/emit.ts so both can import just the types
 * without pulling in socket.io-client itself.
 */
import type { AiCitation, AiIndexRunStatus, MessageDTO, NotificationDTO, TicketDTO } from '../api/types';

// --- Client -> Server (CONTRACT.md §4.2) ---

export interface ChannelJoinPayload {
  channelId: string;
}

export interface ChannelLeavePayload {
  channelId: string;
}

export interface MessageSendPayload {
  channelId: string;
  body?: string;
  replyToMessageId?: string;
  tempId?: string;
}

export interface MessageReadPayload {
  channelId: string;
  lastReadMessageId: string;
}

export interface TypingPayload {
  channelId: string;
}

export interface ClientToServerEvents {
  'channel:join': (payload: ChannelJoinPayload, ack: (res: AckResponse<{ channelId: string }>) => void) => void;
  'channel:leave': (payload: ChannelLeavePayload, ack: (res: AckResponse<{ channelId: string }>) => void) => void;
  'message:send': (payload: MessageSendPayload, ack: (res: AckResponse<MessageDTO>) => void) => void;
  'message:read': (
    payload: MessageReadPayload,
    ack: (res: AckResponse<{ channelId: string; userId: string; lastReadMessageId: string; readAt: string }>) => void,
  ) => void;
  'typing:start': (payload: TypingPayload) => void;
  'typing:stop': (payload: TypingPayload) => void;
}

// --- Server -> Client (CONTRACT.md §4.3) ---

export interface MessageNewEvent {
  message: MessageDTO;
  tempId?: string;
}

export interface MessageUpdatedEvent {
  message: MessageDTO;
}

export interface MessageDeletedEvent {
  messageId: string;
  channelId: string;
}

export interface MessageReadEvent {
  channelId: string;
  userId: string;
  lastReadMessageId: string;
  readAt: string;
}

export interface TypingEvent {
  channelId: string;
  userId: string;
  isTyping: boolean;
}

export interface PresenceUpdateEvent {
  userId: string;
  status: 'online' | 'offline';
  lastSeenAt: string | null;
}

export interface NotificationNewEvent {
  notification: NotificationDTO;
}

export interface ReactionAddedEvent {
  messageId: string;
  emoji: string;
  userId: string;
}

export interface ReactionRemovedEvent {
  messageId: string;
  emoji: string;
  userId: string;
}

/**
 * Tickets have no per-user visibility restriction (CONTRACT.md §1.4/§9.5),
 * so `ticket:created`/`ticket:updated`/`ticket:deleted` broadcast org-wide
 * (`io.emit`, same precedent as `presence:update`) rather than to a
 * channel/user room — every connected client receives every ticket event.
 */
export interface TicketCreatedEvent {
  ticket: TicketDTO;
}

export interface TicketUpdatedEvent {
  ticket: TicketDTO;
}

export interface TicketDeletedEvent {
  ticketId: string;
}

/**
 * AI RAG code assistant (Phase 6 / Module 7) — server-only events, no new
 * client -> server events. `queryId` ties every event in one answer's
 * lifecycle together; `messageId` (only present when the query was asked
 * inside a channel via the `@ai` bot) additionally ties it to the chat
 * message being streamed into, per CONTRACT-given shapes.
 */
export interface AiAnswerStartEvent {
  queryId: string;
  channelId?: string;
  messageId?: string;
  citations: AiCitation[];
}

export interface AiAnswerDeltaEvent {
  queryId: string;
  /** Text chunk to append to the running answer buffer. */
  delta: string;
}

export interface AiAnswerDoneEvent {
  queryId: string;
  answer: string;
  citations: AiCitation[];
  messageId?: string;
}

export interface AiAnswerErrorEvent {
  queryId: string;
  code: string;
  message: string;
}

export interface AiIndexProgressEvent {
  runId: string;
  status: AiIndexRunStatus;
  filesProcessed: number;
  totalFiles: number;
  chunkCount: number;
}

export interface ServerToClientEvents {
  'message:new': (payload: MessageNewEvent) => void;
  'message:updated': (payload: MessageUpdatedEvent) => void;
  'message:deleted': (payload: MessageDeletedEvent) => void;
  'message:read': (payload: MessageReadEvent) => void;
  typing: (payload: TypingEvent) => void;
  'presence:update': (payload: PresenceUpdateEvent) => void;
  'notification:new': (payload: NotificationNewEvent) => void;
  'reaction:added': (payload: ReactionAddedEvent) => void;
  'reaction:removed': (payload: ReactionRemovedEvent) => void;
  'ticket:created': (payload: TicketCreatedEvent) => void;
  'ticket:updated': (payload: TicketUpdatedEvent) => void;
  'ticket:deleted': (payload: TicketDeletedEvent) => void;
  'ai:answer:start': (payload: AiAnswerStartEvent) => void;
  'ai:answer:delta': (payload: AiAnswerDeltaEvent) => void;
  'ai:answer:done': (payload: AiAnswerDoneEvent) => void;
  'ai:answer:error': (payload: AiAnswerErrorEvent) => void;
  'ai:index:progress': (payload: AiIndexProgressEvent) => void;
}

// --- Ack envelope (api/src/sockets/ack.ts — same `code` values as the REST envelope) ---

export interface AckSuccess<T> {
  success: true;
  data: T;
}

export interface AckFailure {
  success: false;
  error: { code: string; message: string };
}

export type AckResponse<T> = AckSuccess<T> | AckFailure;
