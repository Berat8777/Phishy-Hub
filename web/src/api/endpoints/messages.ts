import { http } from '../http';
import type { CursorMeta, MessageDTO, PaginationMeta } from '../types';

export function listMessages(
  channelId: string,
  params?: { before?: string; limit?: number },
): Promise<{ items: MessageDTO[]; hasMore: boolean }> {
  return http
    .get<MessageDTO[]>(`/channels/${channelId}/messages`, { query: params })
    .then((r) => ({ items: r.data, hasMore: (r.meta as CursorMeta | undefined)?.hasMore ?? false }));
}

/**
 * REST message creation. In normal operation the chat UI will prefer the
 * `message:send` socket emit (socket/emit.ts) for the optimistic-send flow,
 * but both paths hit the same server-side `createMessage()` (CONTRACT.md
 * §3.6) and both broadcast `message:new`, so this is kept available too.
 */
export function sendMessage(
  channelId: string,
  input: { body?: string; replyToMessageId?: string; fileIds?: string[]; tempId?: string },
): Promise<MessageDTO> {
  return http.post<MessageDTO>(`/channels/${channelId}/messages`, input).then((r) => r.data);
}

export function listReplies(
  messageId: string,
  params?: { before?: string; limit?: number },
): Promise<{ items: MessageDTO[]; hasMore: boolean }> {
  return http
    .get<MessageDTO[]>(`/messages/${messageId}/replies`, { query: params })
    .then((r) => ({ items: r.data, hasMore: (r.meta as CursorMeta | undefined)?.hasMore ?? false }));
}

export function searchMessages(params: {
  q: string;
  channelId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: MessageDTO[]; meta: PaginationMeta }> {
  return http
    .get<MessageDTO[]>('/messages/search', { query: params })
    .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta }));
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
