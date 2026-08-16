<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PhAvatar } from '@phishyhub/design-system';
import type { AvatarSize } from '@phishyhub/design-system';
import { useUsersStore } from '../../../../stores/users';
import { useFilesStore } from '../../../../stores/files';
import PresenceDot from './PresenceDot.vue';

const props = withDefaults(
  defineProps<{
    userId: string;
    size?: AvatarSize;
    showPresence?: boolean;
  }>(),
  {
    size: 'md',
    showPresence: false,
  },
);

const usersStore = useUsersStore();
const filesStore = useFilesStore();

const user = computed(() => usersStore.getUser(props.userId));
const initials = computed(() => {
  const u = user.value;
  if (!u) return '';
  return `${u.firstName.slice(0, 1)}${u.lastName.slice(0, 1)}`;
});
const displayName = computed(() => (user.value ? `${user.value.firstName} ${user.value.lastName}` : ''));

const avatarUrl = ref<string | undefined>(undefined);

async function loadAvatar(): Promise<void> {
  const fileId = user.value?.avatarFileId;
  if (!fileId) {
    avatarUrl.value = undefined;
    return;
  }
  try {
    avatarUrl.value = await filesStore.getUrl(fileId);
  } catch {
    avatarUrl.value = undefined;
  }
}

async function ensureUser(): Promise<void> {
  if (usersStore.getUser(props.userId)) return;
  try {
    await usersStore.fetchUser(props.userId);
  } catch {
    // Falls back to blank initials — acceptable, this is a presentational avatar not a hard dependency.
  }
}

onMounted(async () => {
  await ensureUser();
  await loadAvatar();
});

watch(
  () => props.userId,
  async () => {
    await ensureUser();
    await loadAvatar();
  },
);

watch(() => user.value?.avatarFileId, loadAvatar);
</script>

<template>
  <PhAvatar :src="avatarUrl" :alt="displayName" :initials="initials" :size="size">
    <template v-if="showPresence" #presence>
      <PresenceDot :user-id="userId" />
    </template>
  </PhAvatar>
</template>
