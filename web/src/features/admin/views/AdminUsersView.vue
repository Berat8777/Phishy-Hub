<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PhBadge, PhButton, PhIcon, PhInput, PhSelect, PhTable, useToast } from '@phishyhub/design-system';
import type { PhTableColumn, PhTableSortPayload, SelectOption } from '@phishyhub/design-system';
import { useAdminStore } from '../stores/admin';
import { useAuthStore } from '../../../stores/auth';
import { canDeleteUsers, canManageUsers } from '../../../lib/permissions';
import { ALL_USER_ROLES, ALL_USER_STATUSES, USER_ROLE_LABELS, USER_STATUS_LABELS } from '../lib/roles';
import { useUserProfile } from '../../../composables/useUserProfile';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import UserCreateDialog from '../components/UserCreateDialog.vue';
import UserEditDialog from '../components/UserEditDialog.vue';
import { isApiError } from '../../../api/errors';
import type { UserDTO } from '../../../api/types';

const adminStore = useAdminStore();
const authStore = useAuthStore();
const userProfile = useUserProfile();
const toast = useToast();

const columns: PhTableColumn[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'department', label: 'Department' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'actions', label: '', width: '96px' },
];

const roleFilter = ref('');
const departmentFilter = ref('');
const statusFilter = ref('');
const search = ref('');
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

const roleOptions: SelectOption[] = [
  { label: 'All roles', value: '' },
  ...ALL_USER_ROLES.map((r) => ({ label: USER_ROLE_LABELS[r], value: r })),
];
const statusOptions: SelectOption[] = [
  { label: 'All statuses', value: '' },
  ...ALL_USER_STATUSES.map((s) => ({ label: USER_STATUS_LABELS[s], value: s })),
];
const departmentOptions = computed<SelectOption[]>(() => [
  { label: 'All departments', value: '' },
  ...adminStore.departments.map((d) => ({ label: d.name, value: d.id })),
]);

function departmentName(id: string | null): string {
  if (!id) return '—';
  return adminStore.departments.find((d) => d.id === id)?.name ?? '—';
}

function applyFilters(): void {
  adminStore.setUserFilters({
    role: (roleFilter.value || undefined) as UserDTO['role'] | undefined,
    departmentId: departmentFilter.value || undefined,
    status: (statusFilter.value || undefined) as UserDTO['status'] | undefined,
    q: search.value || undefined,
  });
  void adminStore.fetchUsers(1);
}

watch([roleFilter, departmentFilter, statusFilter], applyFilters);
watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(applyFilters, 250);
});

function onSort(payload: PhTableSortPayload): void {
  if (payload.key === 'name') {
    adminStore.setUserSort('firstName', payload.direction.toUpperCase() as 'ASC' | 'DESC');
  } else {
    adminStore.setUserSort(payload.key, payload.direction.toUpperCase() as 'ASC' | 'DESC');
  }
  void adminStore.fetchUsers(1);
}

function prevPage(): void {
  if (adminStore.usersMeta.page > 1) void adminStore.fetchUsers(adminStore.usersMeta.page - 1);
}

function nextPage(): void {
  if (adminStore.usersMeta.page < adminStore.usersMeta.totalPages) void adminStore.fetchUsers(adminStore.usersMeta.page + 1);
}

const createOpen = ref(false);
const editTarget = ref<UserDTO | null>(null);
const editOpen = ref(false);

function openEdit(user: UserDTO): void {
  editTarget.value = user;
  editOpen.value = true;
}

async function onDelete(user: UserDTO): Promise<void> {
  if (!window.confirm(`Delete ${user.firstName} ${user.lastName}? This cannot be undone from here.`)) return;
  try {
    await adminStore.deleteUser(user.id);
    toast.push({ title: 'User deleted', variant: 'success' });
  } catch (err) {
    toast.push({
      title: 'Could not delete user',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  }
}

onMounted(async () => {
  await Promise.all([adminStore.fetchDepartments(), adminStore.fetchUsers(1)]);
});
</script>

<template>
  <div class="admin-users-view">
    <header class="admin-users-view__header">
      <h1 class="admin-users-view__title">Users</h1>
      <PhButton v-if="canManageUsers(authStore.user)" size="sm" @click="createOpen = true">
        <PhIcon name="Plus" size="sm" /> New user
      </PhButton>
    </header>

    <div class="admin-users-view__filters">
      <PhInput v-model="search" placeholder="Search name or email…" />
      <PhSelect v-model="roleFilter" :options="roleOptions" />
      <PhSelect v-model="departmentFilter" :options="departmentOptions" />
      <PhSelect v-model="statusFilter" :options="statusOptions" />
    </div>

    <PhTable
      :columns="columns"
      :rows="adminStore.users"
      :loading="adminStore.usersLoading"
      :row-key="(row) => (row as UserDTO).id"
      empty-title="No users found"
      @sort="onSort"
    >
      <template #cell-name="{ row }">
        <button
          type="button"
          class="admin-users-view__name-cell"
          @click="userProfile.open((row as UserDTO).id)"
        >
          <UserAvatar :user-id="(row as UserDTO).id" size="sm" />
          <span>{{ (row as UserDTO).firstName }} {{ (row as UserDTO).lastName }}</span>
        </button>
      </template>
      <template #cell-role="{ row }">
        <PhBadge variant="accent">{{ USER_ROLE_LABELS[(row as UserDTO).role] }}</PhBadge>
      </template>
      <template #cell-department="{ row }">{{ departmentName((row as UserDTO).departmentId) }}</template>
      <template #cell-status="{ row }">
        <PhBadge :variant="(row as UserDTO).status === 'active' ? 'success' : 'default'">
          {{ USER_STATUS_LABELS[(row as UserDTO).status] }}
        </PhBadge>
      </template>
      <template #cell-actions="{ row }">
        <div class="admin-users-view__actions">
          <button
            v-if="canManageUsers(authStore.user)"
            type="button"
            class="admin-users-view__action"
            aria-label="Edit user"
            @click="openEdit(row as UserDTO)"
          >
            <PhIcon name="Pencil" size="xs" />
          </button>
          <button
            v-if="canDeleteUsers(authStore.user)"
            type="button"
            class="admin-users-view__action"
            aria-label="Delete user"
            @click="onDelete(row as UserDTO)"
          >
            <PhIcon name="Trash2" size="xs" />
          </button>
        </div>
      </template>
    </PhTable>

    <div class="admin-users-view__pagination">
      <span>Page {{ adminStore.usersMeta.page }} of {{ Math.max(1, adminStore.usersMeta.totalPages) }} · {{ adminStore.usersMeta.total }} users</span>
      <div class="admin-users-view__pagination-buttons">
        <PhButton variant="secondary" size="sm" :disabled="adminStore.usersMeta.page <= 1" @click="prevPage">Prev</PhButton>
        <PhButton
          variant="secondary"
          size="sm"
          :disabled="adminStore.usersMeta.page >= adminStore.usersMeta.totalPages"
          @click="nextPage"
        >
          Next
        </PhButton>
      </div>
    </div>

    <UserCreateDialog v-model="createOpen" @created="adminStore.fetchUsers(adminStore.usersPage)" />
    <UserEditDialog v-model="editOpen" :user="editTarget" @updated="adminStore.fetchUsers(adminStore.usersPage)" />
  </div>
</template>

<style scoped>
.admin-users-view {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
  padding: var(--ph-space-5);
  overflow-y: auto;
}

.admin-users-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-3);
}

.admin-users-view__title {
  margin: 0;
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.admin-users-view__filters {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: var(--ph-space-3);
}

.admin-users-view__name-cell {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: 0;
  border-radius: var(--ph-radius-sm);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
}

.admin-users-view__name-cell:hover span {
  text-decoration: underline;
}

.admin-users-view__name-cell:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.admin-users-view__actions {
  display: flex;
  align-items: center;
  gap: var(--ph-space-1);
}

.admin-users-view__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
}

.admin-users-view__action:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.admin-users-view__pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.admin-users-view__pagination-buttons {
  display: flex;
  gap: var(--ph-space-2);
}
</style>
