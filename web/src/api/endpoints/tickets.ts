import { http } from '../http';
import type { PaginationMeta, TicketDTO, TicketPriority, TicketStatus } from '../types';

export function listTickets(params?: {
  status?: TicketStatus;
  priority?: TicketPriority;
  /** `'none'` is a special-case meaning "unassigned" (CONTRACT.md §3.9). */
  assignedToId?: string;
  departmentId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}): Promise<{ items: TicketDTO[]; meta: PaginationMeta }> {
  return http
    .get<TicketDTO[]>('/tickets', { query: params })
    .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta }));
}

export function getTicket(ticketId: string): Promise<TicketDTO> {
  return http.get<TicketDTO>(`/tickets/${ticketId}`).then((r) => r.data);
}

export function createTicket(input: {
  title: string;
  description?: string;
  priority?: TicketPriority;
  departmentId?: string;
}): Promise<TicketDTO> {
  return http.post<TicketDTO>('/tickets', input).then((r) => r.data);
}

export function updateTicket(
  ticketId: string,
  patch: { title?: string; description?: string; priority?: TicketPriority; departmentId?: string | null },
): Promise<TicketDTO> {
  return http.patch<TicketDTO>(`/tickets/${ticketId}`, patch).then((r) => r.data);
}

export function deleteTicket(ticketId: string): Promise<void> {
  return http.delete(`/tickets/${ticketId}`).then(() => undefined);
}

export function assignTicket(ticketId: string, assignedToId: string | null): Promise<TicketDTO> {
  return http.post<TicketDTO>(`/tickets/${ticketId}/assign`, { assignedToId }).then((r) => r.data);
}

export function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<TicketDTO> {
  return http.post<TicketDTO>(`/tickets/${ticketId}/status`, { status }).then((r) => r.data);
}
