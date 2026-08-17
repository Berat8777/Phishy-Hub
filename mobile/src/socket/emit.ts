import { getSocket } from './connection';
import { ApiError } from '../api/errors';
import type {
  AckResponse,
  ChannelJoinPayload,
  ChannelLeavePayload,
  MessageReadPayload,
  MessageSendPayload,
  TypingPayload,
} from './events';
import type { MessageDTO } from '../api/types';

/**
 * Ported from web/src/socket/emit.ts. Every ack'd emit races against a
 * timeout so a silently-dead connection can't hang the caller's Promise
 * forever.
 */

const ACK_TIMEOUT_MS = 10_000;

function emitWithAck<TPayload, TData>(event: string, payload: TPayload): Promise<TData> {
  return new Promise<TData>((resolve, reject) => {
    const socket = getSocket();
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Socket emit "${event}" timed out waiting for an ack after ${ACK_TIMEOUT_MS}ms`));
    }, ACK_TIMEOUT_MS);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).emit(event, payload, (ack: AckResponse<TData>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ack.success) {
        resolve(ack.data);
      } else {
        reject(new ApiError(0, ack.error.code, ack.error.message));
      }
    });
  });
}

export function emitChannelJoin(payload: ChannelJoinPayload): Promise<{ channelId: string }> {
  return emitWithAck('channel:join', payload);
}

export function emitChannelLeave(payload: ChannelLeavePayload): Promise<{ channelId: string }> {
  return emitWithAck('channel:leave', payload);
}

export function emitMessageSend(payload: MessageSendPayload): Promise<MessageDTO> {
  return emitWithAck('message:send', payload);
}

export function emitMessageRead(
  payload: MessageReadPayload,
): Promise<{ channelId: string; userId: string; lastReadMessageId: string; readAt: string }> {
  return emitWithAck('message:read', payload);
}

/** No ack per CONTRACT.md §4.2 — fire and forget. */
export function emitTypingStart(payload: TypingPayload): void {
  getSocket().emit('typing:start', payload);
}

/** No ack per CONTRACT.md §4.2 — fire and forget. */
export function emitTypingStop(payload: TypingPayload): void {
  getSocket().emit('typing:stop', payload);
}
