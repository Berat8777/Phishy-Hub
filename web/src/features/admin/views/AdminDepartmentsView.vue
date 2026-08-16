<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { PhButton, PhIcon, PhTable, useToast } from '@phishyhub/design-system';
import type { PhTableColumn } from '@phishyhub/design-system';
import { useAdminStore } from '../stores/admin';
import { useAuthStore } from '../../../stores/auth';
import { useUsersStore } from '../../../stores/users';
import { canDeleteDepartments, canManageDepartments } from '../../../lib/permissions';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import DepartmentDialog from '../components/DepartmentDialog.vue';
import { isApiError } from '../../../api/errors';
import type { DepartmentDTO } from '../../../api/types';

const adminStore = useAdminStore();
const authStore = useAuthStore();
const usersStore = useUsersStore();
const toast = useToast();

const columns: PhTableColumn[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'manager', label: 'Manager' },
  { key: 'actions', label: '', width: '96px' },
];

const dialogOpen = ref(false);
const editTarget = ref<DepartmentDTO | null>(null);

function openCreate(): void {
  editTarget.value = null;
  dialogOpen.value = true;
}

function openEdit(department: DepartmentDTO): void {
  editTarget.value = department;
  dialogOpen.value = true;
}

async function onDelete(department: DepartmentDTO): Promise<void> {
  if (!window.confirm(`Delete "${department.name}"? This cannot be undone.`)) return;
  try {
    await adminStore.deleteDepartment(department.id);
    toast.push({ title: 'Department deleted', variant: 'success' });
  } catch (err) {
    toast.push({
      title: 'Could not delete department',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  }
}

/** Manager names are shown via a lazy per-row lookup through the shared users cache (same pattern `UserAvatar` uses internally) rather than a bulk fetch — department lists are small (`pageSize: 50`). */
async function ensureManagersLoaded(): Promise<void> {
  await Promise.all(
    adminStore.departments
      .filter((d): d is DepartmentDTO & { managerId: string } => Boolean(d.managerId))
      .map((d) => usersStore.fetchUser(d.managerId).catch(() => undefined)),
  );
}

function managerLabel(department: DepartmentDTO): string {
  if (!department.managerId) return 'Unassigned';
  const user = usersStore.getUser(department.managerId);
  return user ? `${user.firstName} ${user.lastName}` : '…';
}

onMounted(async () => {
  await adminStore.fetchDepartments();
  await ensureManagersLoaded();
});
</script>

<template>
  <div class="admin-departments-view">
    <header class="admin-departments-view__header">
      <h1 class="admin-departments-view__title">Departments</h1>
      <PhButton v-if="canManageDepartments(authStore.user)" size="sm" @click="openCreate">
        <PhIcon name="Plus" size="sm" /> New department
      </PhButton>
    </header>

    <PhTable
      :columns="columns"
      :rows="adminStore.departments"
      :loading="adminStore.departmentsLoading"
      :row-key="(row) => (row as DepartmentDTO).id"
      empty-title="No departments yet"
    >
      <template #cell-manager="{ row }">
        <div v-if="(row as DepartmentDTO).managerId" class="admin-departments-view__manager-cell">
          <UserAvatar :user-id="(row as DepartmentDTO).managerId!" size="xs" />
          <span>{{ managerLabel(row as DepartmentDTO) }}</span>
        </div>
        <span v-else class="admin-departments-view__unassigned">Unassigned</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="admin-departments-view__actions">
          <button
            v-if="canManageDepartments(authStore.user)"
            type="button"
            class="admin-departments-view__action"
            aria-label="Edit department"
            @click="openEdit(row as DepartmentDTO)"
          >
            <PhIcon name="Pencil" size="xs" />
          </button>
          <button
            v-if="canDeleteDepartments(authStore.user)"
            type="button"
            class="admin-departments-view__action"
            aria-label="Delete department"
            @click="onDelete(row as DepartmentDTO)"
          >
            <PhIcon name="Trash2" size="xs" />
          </button>
        </div>
      </template>
    </PhTable>

    <DepartmentDialog v-model="dialogOpen" :department="editTarget" @saved="ensureManagersLoaded" />
  </div>
</template>

<style scoped>
.admin-departments-view {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
  padding: var(--ph-space-5);
  overflow-y: auto;
}

.admin-departments-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-3);
}

.admin-departments-view__title {
  margin: 0;
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.admin-departments-view__manager-cell {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
}

.admin-departments-view__unassigned {
  color: var(--ph-color-text-subtle);
}

.admin-departments-view__actions {
  display: flex;
  align-items: center;
  gap: var(--ph-space-1);
}

.admin-departments-view__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
}

.admin-departments-view__action:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}
</style>
