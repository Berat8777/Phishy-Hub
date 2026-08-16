<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PhButton, PhInput, PhModal, PhSelect, useToast } from '@phishyhub/design-system';
import type { SelectOption } from '@phishyhub/design-system';
import * as departmentsApi from '../../../api/endpoints/departments';
import { useAdminStore } from '../stores/admin';
import { useAuthStore } from '../../../stores/auth';
import { canGrantAdminRole } from '../../../lib/permissions';
import { ALL_USER_ROLES, USER_ROLE_LABELS } from '../lib/roles';
import { isApiError } from '../../../api/errors';
import type { DepartmentDTO, UserRole } from '../../../api/types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [] }>();

const adminStore = useAdminStore();
const authStore = useAuthStore();
const toast = useToast();

const email = ref('');
const password = ref('');
const firstName = ref('');
const lastName = ref('');
const role = ref<UserRole>('employee');
const departmentId = ref('');
const departments = ref<DepartmentDTO[]>([]);
const submitting = ref(false);

/** Mirrors `user.service.ts::adminCreateUser`'s "only an existing admin may grant admin" rule — an hr caller never even sees the option (see permissions.ts::canGrantAdminRole). */
const roleOptions = computed<SelectOption[]>(() =>
  ALL_USER_ROLES.filter((r) => r !== 'admin' || canGrantAdminRole(authStore.user)).map((r) => ({
    label: USER_ROLE_LABELS[r],
    value: r,
  })),
);

onMounted(async () => {
  try {
    const { items } = await departmentsApi.listDepartments({ pageSize: 100 });
    departments.value = items;
  } catch {
    departments.value = [];
  }
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      email.value = '';
      password.value = '';
      firstName.value = '';
      lastName.value = '';
      role.value = 'employee';
      departmentId.value = '';
    }
  },
);

function onRoleChange(value: string): void {
  role.value = value as UserRole;
}

function onDepartmentChange(value: string): void {
  departmentId.value = value;
}

const canSubmit = computed(
  () => email.value.trim() && password.value.length >= 8 && firstName.value.trim() && lastName.value.trim(),
);

async function onSubmit(): Promise<void> {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    await adminStore.createUser({
      email: email.value.trim(),
      password: password.value,
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      role: role.value,
      departmentId: departmentId.value || null,
    });
    toast.push({ title: 'User created', variant: 'success' });
    emit('created');
    emit('update:modelValue', false);
  } catch (err) {
    toast.push({
      title: 'Could not create user',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <PhModal :model-value="modelValue" title="New user" size="md" @update:model-value="emit('update:modelValue', $event)">
    <div class="user-create-dialog">
      <div class="user-create-dialog__row">
        <label class="user-create-dialog__field">
          <span>First name</span>
          <PhInput v-model="firstName" />
        </label>
        <label class="user-create-dialog__field">
          <span>Last name</span>
          <PhInput v-model="lastName" />
        </label>
      </div>

      <label class="user-create-dialog__field">
        <span>Email</span>
        <PhInput v-model="email" type="email" />
      </label>

      <label class="user-create-dialog__field">
        <span>Temporary password</span>
        <PhInput v-model="password" type="password" placeholder="At least 8 characters" />
      </label>

      <div class="user-create-dialog__row">
        <label class="user-create-dialog__field">
          <span>Role</span>
          <PhSelect :model-value="role" :options="roleOptions" @update:model-value="onRoleChange" />
        </label>
        <label class="user-create-dialog__field">
          <span>Department</span>
          <PhSelect
            :model-value="departmentId"
            :options="[{ label: 'None', value: '' }, ...departments.map((d) => ({ label: d.name, value: d.id }))]"
            @update:model-value="onDepartmentChange"
          />
        </label>
      </div>
    </div>

    <template #footer>
      <PhButton variant="ghost" @click="emit('update:modelValue', false)">Cancel</PhButton>
      <PhButton :loading="submitting" :disabled="!canSubmit" @click="onSubmit">Create</PhButton>
    </template>
  </PhModal>
</template>

<style scoped>
.user-create-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.user-create-dialog__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ph-space-3);
}

.user-create-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}
</style>
