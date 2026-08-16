<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PhButton, PhPopover } from '@phishyhub/design-system';
import { useUsersStore } from '../../../../stores/users';
import { usePresenceStore } from '../../../../stores/presence';
import { useUserProfile } from '../../../../composables/useUserProfile';
import UserAvatar from '../../../../components/shared/UserAvatar.vue';
import PresenceDot from '../../../../components/shared/PresenceDot.vue';

const props = defineProps<{ userId: string }>();

const usersStore = useUsersStore();
const presenceStore = usePresenceStore();
const userProfile = useUserProfile();
const open = ref(false);

const user = computed(() => usersStore.getUser(props.userId));
const online = computed(() => presenceStore.isOnline(props.userId));

watch(open, async (isOpen) => {
  if (isOpen && !user.value) {
    try {
      await usersStore.fetchUser(props.userId);
    } catch {
      // Popover just shows what it has (nothing) — non-fatal.
    }
  }
});

function viewFullProfile(): void {
  open.value = false;
  userProfile.open(props.userId);
}
</script>

<template>
  <PhPopover v-model="open">
    <template #trigger>
      <button type="button" class="user-popover__trigger" aria-label="View profile">
        <slot>
          <UserAvatar :user-id="userId" size="sm" />
        </slot>
      </button>
    </template>

    <div class="user-popover__content">
      <UserAvatar :user-id="userId" size="lg" />
      <div class="user-popover__info">
        <p class="user-popover__name">{{ user ? `${user.firstName} ${user.lastName}` : 'Loading…' }}</p>
        <p v-if="user" class="user-popover__email">{{ user.email }}</p>
        <p class="user-popover__status">
          <PresenceDot :user-id="userId" />
          <span>{{ online ? 'Online' : 'Offline' }}</span>
        </p>
      </div>
      <PhButton variant="secondary" size="sm" @click="viewFullProfile">View full profile</PhButton>
    </div>
  </PhPopover>
</template>

<style scoped>
.user-popover__trigger {
  display: inline-flex;
  border-radius: var(--ph-radius-full);
}

.user-popover__trigger:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.user-popover__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ph-space-2);
  text-align: center;
  min-width: 180px;
}

.user-popover__info {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
}

.user-popover__name {
  margin: 0;
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.user-popover__email {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.user-popover__status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ph-space-1);
  margin: 0;
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-muted);
}
</style>
