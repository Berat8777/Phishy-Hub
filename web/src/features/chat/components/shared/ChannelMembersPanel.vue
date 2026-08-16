<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PhBadge, PhIcon, PhInput, PhModal, PhSpinner, useToast } from '@phishyhub/design-system';
import * as usersApi from '../../../../api/endpoints/users';
import { useChannelsStore } from '../../../../stores/channels';
import { useUsersStore } from '../../../../stores/users';
import { useAuthStore } from '../../../../stores/auth';
import { canAddChannelMember } from '../../../../lib/permissions';
import { isApiError } from '../../../../api/errors';
import UserAvatar from '../../../../components/shared/UserAvatar.vue';
import UserPopover from './UserPopover.vue';
import type { UserDTO } from '../../../../api/types';

const props = defineProps<{ modelValue: boolean; channelId: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const channelsStore = useChannelsStore();
const usersStore = useUsersStore();
const authStore = useAuthStore();
const toast = useToast();

const loading = ref(false);
const query = ref('');
const searchResults = ref<UserDTO[]>([]);
const searching = ref(false);
const addingUserId = ref<string | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const members = computed(() => channelsStore.getMembers(props.channelId) ?? []);

/** The viewer's own membership row in THIS channel, if any — `canAddChannelMember` needs it (channel-admin-ness lives on the membership, not on UserDTO). */
const ownMembership = computed(
  () => members.value.find((m) => m.userId === authStore.user?.id) ?? null,
);
const canAdd = computed(() => canAddChannelMember(authStore.user, ownMembership.value));

async function ensureMembersAndUsers(): Promise<void> {
  loading.value = true;
  try {
    const list = await channelsStore.fetchMembers(props.channelId);
    await Promise.all(
      list.map((m) => (usersStore.getUser(m.userId) ? Promise.resolve() : usersStore.fetchUser(m.userId).catch(() => undefined))),
    );
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      query.value = '';
      searchResults.value = [];
      void ensureMembersAndUsers();
    }
  },
);

watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!q) {
    searchResults.value = [];
    return;
  }
  searching.value = true;
  debounceTimer = setTimeout(async () => {
    try {
      const { items } = await usersApi.listUsers({ q, pageSize: 8 });
      searchResults.value = items.filter((u) => !members.value.some((m) => m.userId === u.id));
    } catch {
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  }, 200);
});

function displayName(userId: string): string {
  const user = usersStore.getUser(userId);
  return user ? `${user.firstName} ${user.lastName}` : 'Unknown user';
}

function orgRole(userId: string): string {
  const user = usersStore.getUser(userId);
  return user ? user.role : '';
}

async function addMember(user: UserDTO): Promise<void> {
  addingUserId.value = user.id;
  try {
    await channelsStore.addMember(props.channelId, user.id);
    usersStore.upsert(user);
    searchResults.value = searchResults.value.filter((u) => u.id !== user.id);
  } catch (err) {
    toast.push({
      title: 'Could not add member',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    addingUserId.value = null;
  }
}
</script>

<template>
  <PhModal
    :model-value="modelValue"
    title="Channel members"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="channel-members-panel">
      <PhSpinner v-if="loading" size="md" />

      <ul v-else class="channel-members-panel__list">
        <li v-for="member in members" :key="member.id" class="channel-members-panel__item">
          <UserPopover :user-id="member.userId" class="channel-members-panel__trigger">
            <div class="channel-members-panel__row">
              <UserAvatar :user-id="member.userId" size="sm" />
              <div class="channel-members-panel__info">
                <span class="channel-members-panel__name">{{ displayName(member.userId) }}</span>
                <span class="channel-members-panel__org-role">{{ orgRole(member.userId) }}</span>
              </div>
              <PhBadge :variant="member.channelRole === 'admin' ? 'accent' : 'default'">
                {{ member.channelRole }}
              </PhBadge>
            </div>
          </UserPopover>
        </li>
      </ul>

      <div v-if="canAdd" class="channel-members-panel__add">
        <PhInput v-model="query" placeholder="Add a person by name or email…" />
        <PhSpinner v-if="searching" size="sm" />
        <ul v-else-if="searchResults.length" class="channel-members-panel__results">
          <li
            v-for="user in searchResults"
            :key="user.id"
            class="channel-members-panel__result"
            @click="addMember(user)"
          >
            <UserAvatar :user-id="user.id" size="sm" />
            <span>{{ user.firstName }} {{ user.lastName }}</span>
            <PhSpinner v-if="addingUserId === user.id" size="sm" />
            <PhIcon v-else name="Plus" size="sm" class="channel-members-panel__result-icon" />
          </li>
        </ul>
      </div>
    </div>
  </PhModal>
</template>

<style scoped>
.channel-members-panel {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.channel-members-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}

.channel-members-panel__item {
  display: flex;
}

.channel-members-panel__trigger {
  width: 100%;
}

.channel-members-panel__trigger :deep(.user-popover__trigger) {
  width: 100%;
  border-radius: var(--ph-radius-md);
}

.channel-members-panel__row {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  width: 100%;
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-md);
}

.channel-members-panel__row:hover {
  background-color: var(--ph-color-surface-hover);
}

.channel-members-panel__info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  text-align: left;
}

.channel-members-panel__name {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-members-panel__org-role {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
  text-transform: capitalize;
}

.channel-members-panel__add {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
  padding-top: var(--ph-space-3);
  border-top: 1px solid var(--ph-color-border-subtle);
}

.channel-members-panel__results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
}

.channel-members-panel__result {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  cursor: pointer;
}

.channel-members-panel__result:hover {
  background-color: var(--ph-color-surface-hover);
}

.channel-members-panel__result span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-members-panel__result-icon {
  color: var(--ph-color-text-muted);
}
</style>
