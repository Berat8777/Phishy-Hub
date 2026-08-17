import { http } from '../http';
import type { CursorMeta, MessageDTO } from '../types';

export function listMessages(
  channelId: string,
  params?: { before?: string; limit?: number },
): Promise<{ items: MessageDTO[]; hasMore: boolean }> {
  return http
    .get<MessageDTO[]>(`/channels/${channelId}/messages`, { query: params })
    .then((r) => ({ items: r.data, hasMore: (r.meta as CursorMeta | undefined)?.hasMore ?? false }));
}

/**
 * REST message creation — used when the message carries `fileIds`
 * (CONTRACT.md §4.2's socket `message:send` payload has no `fileIds` field,
 * only the REST body does). Plain text sends prefer the socket emit
 * instead, see src/socket/emit.ts.
 */
export function sendMessage(
  channelId: string,
  input: { body?: string; replyToMessageId?: string; fileIds?: string[]; tempId?: string },
): Promise<MessageDTO> {
  return http.post<MessageDTO>(`/channels/${channelId}/messages`, input).then((r) => r.data);
}

export function addReaction(messageId: string, emoji: string): Promise<MessageDTO> {
  return http.put<MessageDTO>(`/messages/${messageId}/reactions`, { emoji }).then((r) => r.data);
}

export function removeReaction(messageId: string, emoji: string): Promise<MessageDTO> {
  return http.delete<MessageDTO>(`/messages/${messageId}/reactions`, { query: { emoji } }).then((r) => r.data);
}

export function updateMessage(messageId: string, body: string): Promise<MessageDTO> {
  return http.patch<MessageDTO>(`/messages/${messageId}`, { body }).then((r) => r.data);
}

export function deleteMessage(messageId: string): Promise<void> {
  return http.delete(`/messages/${messageId}`).then(() => undefined);
}
