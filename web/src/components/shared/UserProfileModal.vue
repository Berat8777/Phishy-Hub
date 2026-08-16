<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PhBadge, PhButton, PhModal, PhSpinner } from '@phishyhub/design-system';
import { useUserProfileStore } from '../../stores/userProfile';
import { useUsersStore } from '../../stores/users';
import { useDepartmentsStore } from '../../stores/departments';
import { usePresenceStore } from '../../stores/presence';
import { useAuthStore } from '../../stores/auth';
import { canManageUsers } from '../../lib/permissions';
import { formatRelative } from '../../lib/date';
import { USER_ROLE_LABELS, USER_STATUS_LABELS } from '../../features/admin/lib/roles';
import UserAvatar from './UserAvatar.vue';
import PresenceDot from './PresenceDot.vue';
import UserProfileEditDialog from './UserProfileEditDialog.vue';
// Reused, not duplicated — the admin-scoped (role/status/department) edit
// fields already live here (`features/admin/components/UserEditDialog.vue`),
// so this modal opens that same dialog for a privileged viewer rather than
// reimplementing a second copy of the same form.
import AdminUserEditDialog from '../../features/admin/components/UserEditDialog.vue';

const profileStore = useUserProfileStore();
const usersStore = useUsersStore();
const departmentsStore = useDepartmentsStore();
const presenceStore = usePresenceStore();
const authStore = useAuthStore();

const open = computed(() => profileStore.openUserId !== null);
const loading = ref(false);
const selfEditOpen = ref(false);
const adminEditOpen = ref(false);

const user = computed(() => (profileStore.openUserId ? usersStore.getUser(profileStore.openUserId) : undefined));
const department = computed(() => (user.value?.departmentId ? departmentsStore.getDepartment(user.value.departmentId) : undefined));
const isOwnProfile = computed(() => !!user.value && user.value.id === authStore.user?.id);
const online = computed(() => (user.value ? presenceStore.isOnline(user.value.id) : false));
const lastSeenLabel = computed(() => {
  const u = user.value;
  if (!u) return '';
  if (online.value) return 'Online';
  const lastSeenAt = presenceStore.byUserId.get(u.id)?.lastSeenAt ?? u.lastSeenAt;
  return lastSeenAt ? `Last seen ${formatRelative(lastSeenAt)}` : 'Offline';
});

async function loadProfile(userId: string): Promise<void> {
  loading.value = true;
  try {
    const loaded = await usersStore.fetchUser(userId);
    if (loaded.departmentId) {
      await departmentsStore.fetchDepartment(loaded.departmentId).catch(() => undefined);
    }
  } finally {
    loading.value = false;
  }
}

watch(
  () => profileStore.openUserId,
  (userId) => {
    if (userId) void loadProfile(userId);
  },
  { immediate: true },
);

function onModalUpdate(value: boolean): void {
  if (!value) profileStore.close();
}

function onEditClick(): void {
  if (isOwnProfile.value) {
    selfEditOpen.value = true;
  } else {
    adminEditOpen.value = true;
  }
}
</script>

<template>
  <PhModal :model-value="open" title="Profile" size="sm" @update:model-value="onModalUpdate">
    <div v-if="loading && !user" class="user-profile-modal__loading">
      <PhSpinner size="md" />
    </div>

    <div v-else-if="user" class="user-profile-modal">
      <div class="user-profile-modal__header">
        <UserAvatar :user-id="user.id" size="xl" show-presence />
        <div class="user-profile-modal__identity">
          <p class="user-profile-modal__name">{{ user.firstName }} {{ user.lastName }}</p>
          <p class="user-profile-modal__email">{{ user.email }}</p>
          <p class="user-profile-modal__presence">
            <PresenceDot :user-id="user.id" />
            <span>{{ lastSeenLabel }}</span>
          </p>
        </div>
      </div>

      <dl class="user-profile-modal__facts">
        <div class="user-profile-modal__fact">
          <dt>Role</dt>
          <dd><PhBadge variant="accent">{{ USER_ROLE_LABELS[user.role] }}</PhBadge></dd>
        </div>
        <div class="user-profile-modal__fact">
          <dt>Department</dt>
          <dd>{{ department?.name ?? (user.departmentId ? '…' : '—') }}</dd>
        </div>
        <div class="user-profile-modal__fact">
          <dt>Status</dt>
          <dd>
            <PhBadge :variant="user.status === 'active' ? 'success' : 'default'">
              {{ USER_STATUS_LABELS[user.status] }}
            </PhBadge>
          </dd>
        </div>
      </dl>

      <div v-if="isOwnProfile || canManageUsers(authStore.user)" class="user-profile-modal__actions">
        <PhButton variant="secondary" size="sm" @click="onEditClick">
          {{ isOwnProfile ? 'Edit profile' : 'Edit user' }}
        </PhButton>
      </div>
    </div>

    <p v-else class="user-profile-modal__empty">Couldn't load this profile.</p>
  </PhModal>

  <UserProfileEditDialog v-if="user" v-model="selfEditOpen" :user="user" />
  <AdminUserEditDialog v-if="user" v-model="adminEditOpen" :user="user" />
</template>

<style scoped>
.user-profile-modal__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ph-space-6) 0;
}

.user-profile-modal {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-5);
}

.user-profile-modal__header {
  display: flex;
  align-items: center;
  gap: var(--ph-space-4);
}

.user-profile-modal__identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-profile-modal__name {
  margin: 0;
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.user-profile-modal__email {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-profile-modal__presence {
  display: flex;
  align-items: center;
  gap: var(--ph-space-1);
  margin: var(--ph-space-1) 0 0;
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-muted);
}

.user-profile-modal__facts {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-3);
  margin: 0;
}

.user-profile-modal__fact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-3);
}

.user-profile-modal__fact dt {
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.user-profile-modal__fact dd {
  margin: 0;
}

.user-profile-modal__actions {
  display: flex;
  justify-content: flex-end;
}

.user-profile-modal__empty {
  margin: 0;
  padding: var(--ph-space-5) 0;
  text-align: center;
  color: var(--ph-color-text-muted);
}
</style>
