<script setup lang="ts">
import { ref, watch } from 'vue';
import { PhButton, PhInput, PhModal, useToast } from '@phishyhub/design-system';
import { useAuthStore } from '../../stores/auth';
import { useUsersStore } from '../../stores/users';
import { isApiError } from '../../api/errors';
import type { UserDTO } from '../../api/types';

/**
 * Self-service edit, used only from `UserProfileModal.vue` when the viewer
 * is looking at THEIR OWN profile — `PATCH /users/me` only accepts
 * `{firstName?, lastName?, avatarFileId?}` (CONTRACT.md §3.3), a
 * deliberately narrower surface than `admin/components/UserEditDialog.vue`
 * (role/status/department, `PATCH /users/:id`, admin/hr only). No avatar
 * field here — there's no avatar-upload widget anywhere in the app yet to
 * reuse, so that stays out of scope for this pass.
 */
const props = defineProps<{ modelValue: boolean; user: UserDTO }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; updated: [] }>();

const authStore = useAuthStore();
const usersStore = useUsersStore();
const toast = useToast();

const firstName = ref('');
const lastName = ref('');
const submitting = ref(false);

watch(
  () => [props.modelValue, props.user] as const,
  ([open, user]) => {
    if (open) {
      firstName.value = user.firstName;
      lastName.value = user.lastName;
    }
  },
  { immediate: true },
);

async function onSubmit(): Promise<void> {
  if (!firstName.value.trim() || !lastName.value.trim()) return;
  submitting.value = true;
  try {
    const updated = await authStore.updateSelf({
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
    });
    // `updated` carries whatever `managedDepartmentIds` the auth store had
    // preserved on its own `user` ref (see `authStore.updateSelf`'s doc
    // comment) — harmless to carry into `usersStore` too even though that
    // cache is documented (`api/types.ts`'s `UserDTO`) to only ever hold
    // `[]` there outside login/register/`GET /auth/me`, since nothing reads
    // `managedDepartmentIds` off a `usersStore` entry.
    usersStore.upsert(updated);
    toast.push({ title: 'Profile updated', variant: 'success' });
    emit('updated');
    emit('update:modelValue', false);
  } catch (err) {
    toast.push({
      title: 'Could not update profile',
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
    title="Edit profile"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="user-profile-edit-dialog">
      <label class="user-profile-edit-dialog__field">
        <span>First name</span>
        <PhInput v-model="firstName" />
      </label>
      <label class="user-profile-edit-dialog__field">
        <span>Last name</span>
        <PhInput v-model="lastName" />
      </label>
    </div>

    <template #footer>
      <PhButton variant="ghost" @click="emit('update:modelValue', false)">Cancel</PhButton>
      <PhButton :loading="submitting" :disabled="!firstName.trim() || !lastName.trim()" @click="onSubmit">
        Save
      </PhButton>
    </template>
  </PhModal>
</template>

<style scoped>
.user-profile-edit-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.user-profile-edit-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}
</style>
