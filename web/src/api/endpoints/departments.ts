import { http } from '../http';
import type { DepartmentDTO, PaginationMeta } from '../types';

export function listDepartments(params?: { page?: number; pageSize?: number }): Promise<{
  items: DepartmentDTO[];
  meta: PaginationMeta;
}> {
  return http
    .get<DepartmentDTO[]>('/departments', { query: params })
    .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta }));
}

export function getDepartment(departmentId: string): Promise<DepartmentDTO> {
  return http.get<DepartmentDTO>(`/departments/${departmentId}`).then((r) => r.data);
}

/** `POST /departments` — `admin`/`hr` only (CONTRACT.md §3.4). `managerId`, if given, must reference an existing user or the server 400s. */
export function createDepartment(input: { name: string; managerId?: string | null }): Promise<DepartmentDTO> {
  return http.post<DepartmentDTO>('/departments', input).then((r) => r.data);
}

/** `PATCH /departments/:id` — `admin`/`hr` only. */
export function updateDepartment(
  departmentId: string,
  patch: { name?: string; managerId?: string | null },
): Promise<DepartmentDTO> {
  return http.patch<DepartmentDTO>(`/departments/${departmentId}`, patch).then((r) => r.data);
}

/** `DELETE /departments/:id` — `admin` only (CONTRACT.md §3.4, narrower than create/update). */
export function deleteDepartment(departmentId: string): Promise<void> {
  return http.delete(`/departments/${departmentId}`).then(() => undefined);
}
