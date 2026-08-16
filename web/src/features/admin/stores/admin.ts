import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as usersApi from '../../../api/endpoints/users';
import * as departmentsApi from '../../../api/endpoints/departments';
import type { DepartmentDTO, PaginationMeta, UserDTO, UserRole, UserStatus } from '../../../api/types';

export interface AdminUserFilters {
  role?: UserRole;
  departmentId?: string;
  status?: UserStatus;
  q?: string;
}

const EMPTY_META: PaginationMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
const USERS_PAGE_SIZE = 20;

/**
 * Paginated user table state + filters, department list, and the pieces
 * `AdminOverviewView` derives cheap counters from — no dedicated backend
 * stats endpoint (the architect explicitly ruled that out this phase).
 */
export const useAdminStore = defineStore('admin', () => {
  const users = ref<UserDTO[]>([]);
  const usersMeta = ref<PaginationMeta>(EMPTY_META);
  const usersLoading = ref(false);
  const usersFilters = ref<AdminUserFilters>({});
  const usersPage = ref(1);
  const usersSort = ref<string | undefined>(undefined);
  const usersOrder = ref<'ASC' | 'DESC'>('ASC');

  const departments = ref<DepartmentDTO[]>([]);
  const departmentsMeta = ref<PaginationMeta>(EMPTY_META);
  const departmentsLoading = ref(false);

  function setUserFilters(patch: AdminUserFilters): void {
    usersFilters.value = { ...patch };
    usersPage.value = 1;
  }

  function setUserSort(sort: string | undefined, order: 'ASC' | 'DESC'): void {
    usersSort.value = sort;
    usersOrder.value = order;
  }

  async function fetchUsers(page = usersPage.value): Promise<void> {
    usersPage.value = page;
    usersLoading.value = true;
    try {
      const { items, meta } = await usersApi.listUsers({
        ...usersFilters.value,
        page,
        pageSize: USERS_PAGE_SIZE,
        sort: usersSort.value,
        order: usersSort.value ? usersOrder.value : undefined,
      });
      users.value = items;
      usersMeta.value = meta;
    } finally {
      usersLoading.value = false;
    }
  }

  async function createUser(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
    departmentId?: string | null;
  }): Promise<UserDTO> {
    const user = await usersApi.createUser(input);
    await fetchUsers(1);
    return user;
  }

  async function updateUser(
    id: string,
    patch: { role?: UserRole; status?: UserStatus; departmentId?: string | null },
  ): Promise<UserDTO> {
    const user = await usersApi.updateUser(id, patch);
    const index = users.value.findIndex((u) => u.id === id);
    if (index !== -1) {
      const next = users.value.slice();
      next.splice(index, 1, user);
      users.value = next;
    }
    return user;
  }

  async function deleteUser(id: string): Promise<void> {
    await usersApi.deleteUser(id);
    users.value = users.value.filter((u) => u.id !== id);
    usersMeta.value = { ...usersMeta.value, total: Math.max(0, usersMeta.value.total - 1) };
  }

  async function fetchDepartments(page = 1): Promise<void> {
    departmentsLoading.value = true;
    try {
      const { items, meta } = await departmentsApi.listDepartments({ page, pageSize: 50 });
      departments.value = items;
      departmentsMeta.value = meta;
    } finally {
      departmentsLoading.value = false;
    }
  }

  async function createDepartment(input: { name: string; managerId?: string | null }): Promise<DepartmentDTO> {
    const department = await departmentsApi.createDepartment(input);
    await fetchDepartments(1);
    return department;
  }

  async function updateDepartment(
    id: string,
    patch: { name?: string; managerId?: string | null },
  ): Promise<DepartmentDTO> {
    const department = await departmentsApi.updateDepartment(id, patch);
    const index = departments.value.findIndex((d) => d.id === id);
    if (index !== -1) {
      const next = departments.value.slice();
      next.splice(index, 1, department);
      departments.value = next;
    }
    return department;
  }

  async function deleteDepartment(id: string): Promise<void> {
    await departmentsApi.deleteDepartment(id);
    departments.value = departments.value.filter((d) => d.id !== id);
    departmentsMeta.value = { ...departmentsMeta.value, total: Math.max(0, departmentsMeta.value.total - 1) };
  }

  function reset(): void {
    users.value = [];
    usersMeta.value = EMPTY_META;
    usersLoading.value = false;
    usersFilters.value = {};
    usersPage.value = 1;
    usersSort.value = undefined;
    usersOrder.value = 'ASC';
    departments.value = [];
    departmentsMeta.value = EMPTY_META;
    departmentsLoading.value = false;
  }

  return {
    users,
    usersMeta,
    usersLoading,
    usersFilters,
    usersPage,
    usersSort,
    usersOrder,
    departments,
    departmentsMeta,
    departmentsLoading,
    setUserFilters,
    setUserSort,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    fetchDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    reset,
  };
});
