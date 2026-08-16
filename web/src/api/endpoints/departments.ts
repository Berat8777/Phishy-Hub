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
