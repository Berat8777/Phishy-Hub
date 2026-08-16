import { http } from '../http';
import type { PaginationMeta, UserDTO, UserRole, UserStatus } from '../types';

export function listUsers(params?: {
  role?: UserRole;
  status?: UserStatus;
  departmentId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
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

/** `POST /users` — `admin`/`hr` only (CONTRACT.md §3.3). `role: 'admin'` 403s server-side unless the caller is themselves an admin (user.service.ts::adminCreateUser) — gate the option client-side with `permissions.ts::canGrantAdminRole`. */
export function createUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  departmentId?: string | null;
}): Promise<UserDTO> {
  return http.post<UserDTO>('/users', input).then((r) => r.data);
}

/** `PATCH /users/:id` — `admin`/`hr` only; same `role: 'admin'` grant restriction as `createUser`. */
export function updateUser(
  userId: string,
  patch: { role?: UserRole; status?: UserStatus; departmentId?: string | null },
): Promise<UserDTO> {
  return http.patch<UserDTO>(`/users/${userId}`, patch).then((r) => r.data);
}

/** `DELETE /users/:id` — `admin` only (soft delete, CONTRACT.md §3.3). */
export function deleteUser(userId: string): Promise<void> {
  return http.delete(`/users/${userId}`).then(() => undefined);
}
