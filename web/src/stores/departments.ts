import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as departmentsApi from '../api/endpoints/departments';
import type { DepartmentDTO } from '../api/types';

/**
 * Thin id-keyed department cache, filled on demand — same shape as
 * `stores/users.ts`. `GET /departments/:id` is open to any authenticated
 * caller (CONTRACT.md §3.4), so this is safe to hit from anywhere a
 * department NAME needs to be resolved (e.g. `UserProfileModal.vue`)
 * without depending on `features/admin/stores/admin.ts`'s paginated
 * department table, which is scoped to the admin views.
 */
export const useDepartmentsStore = defineStore('departments', () => {
  const byId = ref<Map<string, DepartmentDTO>>(new Map());

  function upsert(department: DepartmentDTO): void {
    byId.value.set(department.id, department);
  }

  function getDepartment(departmentId: string): DepartmentDTO | undefined {
    return byId.value.get(departmentId);
  }

  async function fetchDepartment(departmentId: string): Promise<DepartmentDTO> {
    const cached = byId.value.get(departmentId);
    if (cached) return cached;
    const department = await departmentsApi.getDepartment(departmentId);
    upsert(department);
    return department;
  }

  function reset(): void {
    byId.value = new Map();
  }

  return { byId, upsert, getDepartment, fetchDepartment, reset };
});
