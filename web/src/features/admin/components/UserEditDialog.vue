<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PhButton, PhModal, PhSelect, useToast } from '@phishyhub/design-system';
import type { SelectOption } from '@phishyhub/design-system';
import * as departmentsApi from '../../../api/endpoints/departments';
import { useAdminStore } from '../stores/admin';
import { useAuthStore } from '../../../stores/auth';
import { canGrantAdminRole } from '../../../lib/permissions';
import { ALL_USER_ROLES, ALL_USER_STATUSES, USER_ROLE_LABELS, USER_STATUS_LABELS } from '../lib/roles';
import { isApiError } from '../../../api/errors';
import type { DepartmentDTO, UserDTO, UserRole, UserStatus } from '../../../api/types';

/**
 * `PATCH /users/:id` only accepts `{role?, status?, departmentId?}`
 * (CONTRACT.md §3.3) — name/email are self-service only
 * (`PATCH /users/me`), so this dialog deliberately has no name/email
 * fields, unlike `UserCreateDialog`.
 */
const props = defineProps<{ modelValue: boolean; user: UserDTO | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; updated: [] }>();

const adminStore = useAdminStore();
const authStore = useAuthStore();
const toast = useToast();

const role = ref<UserRole>('employee');
const status = ref<UserStatus>('active');
const departmentId = ref('');
const departments = ref<DepartmentDTO[]>([]);
const submitting = ref(false);

const roleOptions = computed<SelectOption[]>(() =>
  ALL_USER_ROLES.filter((r) => r !== 'admin' || canGrantAdminRole(authStore.user) || props.user?.role === 'admin').map(
    (r) => ({ label: USER_ROLE_LABELS[r], value: r }),
  ),
);

const statusOptions: SelectOption[] = ALL_USER_STATUSES.map((s) => ({ label: USER_STATUS_LABELS[s], value: s }));

onMounted(async () => {
  try {
    const { items } = await departmentsApi.listDepartments({ pageSize: 100 });
    departments.value = items;
  } catch {
    departments.value = [];
  }
});

watch(
  () => [props.modelValue, props.user] as const,
  ([open, user]) => {
    if (open && user) {
      role.value = user.role;
      status.value = user.status;
      departmentId.value = user.departmentId ?? '';
    }
  },
  { immediate: true },
);

function onRoleChange(value: string): void {
  role.value = value as UserRole;
}

function onStatusChange(value: string): void {
  status.value = value as UserStatus;
}

function onDepartmentChange(value: string): void {
  departmentId.value = value;
}

async function onSubmit(): Promise<void> {
  if (!props.user) return;
  submitting.value = true;
  try {
    // `adminUpdateUser` (api/src/services/user.service.ts) 403s whenever
    // `role: 'admin'` is PRESENT in the body and the caller isn't an admin —
    // it doesn't diff against the prior value, so re-sending the user's
    // already-current role would trip that check for an hr caller editing
    // an existing admin user's status/department. Only send `role` when it
    // actually changed.
    const patch: { role?: UserRole; status: UserStatus; departmentId: string | null } = {
      status: status.value,
      departmentId: departmentId.value || null,
    };
    if (role.value !== props.user.role) patch.role = role.value;
    await adminStore.updateUser(props.user.id, patch);
    toast.push({ title: 'User updated', variant: 'success' });
    emit('updated');
    emit('update:modelValue', false);
  } catch (err) {
    toast.push({
      title: 'Could not update user',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <PhModal
    :model-value="modelValue"
    :title="user ? `Edit ${user.firstName} ${user.lastName}` : 'Edit user'"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="user" class="user-edit-dialog">
      <label class="user-edit-dialog__field">
        <span>Role</span>
        <PhSelect :model-value="role" :options="roleOptions" @update:model-value="onRoleChange" />
      </label>

      <label class="user-edit-dialog__field">
        <span>Status</span>
        <PhSelect :model-value="status" :options="statusOptions" @update:model-value="onStatusChange" />
      </label>

      <label class="user-edit-dialog__field">
        <span>Department</span>
        <PhSelect
          :model-value="departmentId"
          :options="[{ label: 'None', value: '' }, ...departments.map((d) => ({ label: d.name, value: d.id }))]"
          @update:model-value="onDepartmentChange"
        />
      </label>
    </div>

    <template #footer>
      <PhButton variant="ghost" @click="emit('update:modelValue', false)">Cancel</PhButton>
      <PhButton :loading="submitting" @click="onSubmit">Save</PhButton>
    </template>
  </PhModal>
</template>

<style scoped>
.user-edit-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.user-edit-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}
</style>
