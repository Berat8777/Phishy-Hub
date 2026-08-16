<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PhButton, PhInput, PhModal, useToast } from '@phishyhub/design-system';
import { useAdminStore } from '../stores/admin';
import { useUsersStore } from '../../../stores/users';
import UserPicker from './UserPicker.vue';
import { isApiError } from '../../../api/errors';
import type { DepartmentDTO, UserDTO } from '../../../api/types';

/** `null` department = create mode; a DTO = edit mode (CONTRACT.md §3.4 `POST`/`PATCH /departments`). */
const props = defineProps<{ modelValue: boolean; department: DepartmentDTO | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>();

const adminStore = useAdminStore();
const usersStore = useUsersStore();
const toast = useToast();

const name = ref('');
const managerId = ref<string | null>(null);
const manager = ref<UserDTO | null>(null);
const submitting = ref(false);

const isEdit = computed(() => props.department !== null);

watch(
  () => [props.modelValue, props.department] as const,
  async ([open, department]) => {
    if (!open) return;
    name.value = department?.name ?? '';
    managerId.value = department?.managerId ?? null;
    manager.value = null;
    if (department?.managerId) {
      try {
        manager.value = await usersStore.fetchUser(department.managerId);
      } catch {
        manager.value = null;
      }
    }
  },
  { immediate: true },
);

function onManagerSelect(userId: string | null): void {
  managerId.value = userId;
  manager.value = userId ? (usersStore.getUser(userId) ?? null) : null;
}

async function onSubmit(): Promise<void> {
  const trimmed = name.value.trim();
  if (!trimmed) return;
  submitting.value = true;
  try {
    if (isEdit.value && props.department) {
      await adminStore.updateDepartment(props.department.id, { name: trimmed, managerId: managerId.value });
      toast.push({ title: 'Department updated', variant: 'success' });
    } else {
      await adminStore.createDepartment({ name: trimmed, managerId: managerId.value });
      toast.push({ title: 'Department created', variant: 'success' });
    }
    emit('saved');
    emit('update:modelValue', false);
  } catch (err) {
    toast.push({
      title: 'Could not save department',
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
    :title="isEdit ? 'Edit department' : 'New department'"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="department-dialog">
      <label class="department-dialog__field">
        <span>Name</span>
        <PhInput v-model="name" placeholder="e.g. Engineering" />
      </label>

      <label class="department-dialog__field">
        <span>Manager</span>
        <UserPicker :selected="manager" placeholder="No manager" @select="onManagerSelect" />
      </label>
    </div>

    <template #footer>
      <PhButton variant="ghost" @click="emit('update:modelValue', false)">Cancel</PhButton>
      <PhButton :loading="submitting" :disabled="!name.trim()" @click="onSubmit">
        {{ isEdit ? 'Save' : 'Create' }}
      </PhButton>
    </template>
  </PhModal>
</template>

<style scoped>
.department-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.department-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}
</style>
