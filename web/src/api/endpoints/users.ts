import { http } from '../http';
import type { PaginationMeta, UserDTO, UserRole, UserStatus } from '../types';

export function listUsers(params?: {
  role?: UserRole;
  status?: UserStatus;
  departmentId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: UserDTO[]; meta: PaginationMeta }> {
  return http
    .get<UserDTO[]>('/users', { query: params })
    .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta }));
}

export function getUser(userId: string): Promise<UserDTO> {
  return http.get<UserDTO>(`/users/${userId}`).then((r) => r.data);
}

export function updateMe(input: { firstName?: string; lastName?: string; avatarFileId?: string }): Promise<UserDTO> {
  return http.patch<UserDTO>('/users/me', input).then((r) => r.data);
}

export function changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
  return http.post('/users/me/change-password', input).then(() => undefined);
}
