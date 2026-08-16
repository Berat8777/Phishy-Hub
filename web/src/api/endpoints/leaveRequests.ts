import { http } from '../http';
import type {
  LeaveBalanceDTO,
  LeaveRequestDTO,
  LeaveRequestReviewDTO,
  LeaveRequestStatus,
  LeaveRequestType,
  PaginationMeta,
} from '../types';

export function listLeaveRequests(params?: {
  status?: LeaveRequestStatus;
  /** Ignored by the server for non-hr/admin callers, which always self-scope (CONTRACT.md §3.8). */
  userId?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}): Promise<{ items: LeaveRequestDTO[]; meta: PaginationMeta }> {
  return http
    .get<LeaveRequestDTO[]>('/leave-requests', { query: params })
    .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta }));
}

export function getLeaveRequest(id: string): Promise<LeaveRequestDTO> {
  return http.get<LeaveRequestDTO>(`/leave-requests/${id}`).then((r) => r.data);
}

export function createLeaveRequest(input: {
  type: LeaveRequestType;
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<LeaveRequestDTO> {
  return http.post<LeaveRequestDTO>('/leave-requests', input).then((r) => r.data);
}

export function reviewLeaveRequest(id: string, input: LeaveRequestReviewDTO): Promise<LeaveRequestDTO> {
  return http.post<LeaveRequestDTO>(`/leave-requests/${id}/review`, input).then((r) => r.data);
}

export function cancelLeaveRequest(id: string): Promise<LeaveRequestDTO> {
  return http.post<LeaveRequestDTO>(`/leave-requests/${id}/cancel`).then((r) => r.data);
}

export function getLeaveBalance(params?: { userId?: string; year?: number }): Promise<LeaveBalanceDTO[]> {
  return http.get<LeaveBalanceDTO[]>('/leave-requests/balance', { query: params }).then((r) => r.data);
}
