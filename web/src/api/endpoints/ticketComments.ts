import { http } from '../http';
import type { PaginationMeta, TicketCommentDTO } from '../types';

export function listComments(
  ticketId: string,
  params?: { page?: number; pageSize?: number },
): Promise<{ items: TicketCommentDTO[]; meta: PaginationMeta }> {
  return http
    .get<TicketCommentDTO[]>(`/tickets/${ticketId}/comments`, { query: params })
    .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta }));
}

export function createComment(ticketId: string, body: string): Promise<TicketCommentDTO> {
  return http.post<TicketCommentDTO>(`/tickets/${ticketId}/comments`, { body }).then((r) => r.data);
}

export function updateComment(ticketId: string, commentId: string, body: string): Promise<TicketCommentDTO> {
  return http.patch<TicketCommentDTO>(`/tickets/${ticketId}/comments/${commentId}`, { body }).then((r) => r.data);
}

export function deleteComment(ticketId: string, commentId: string): Promise<void> {
  return http.delete(`/tickets/${ticketId}/comments/${commentId}`).then(() => undefined);
}
