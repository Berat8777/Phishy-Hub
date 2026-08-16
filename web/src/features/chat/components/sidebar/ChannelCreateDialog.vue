<script setup lang="ts">
import { ref, watch } from 'vue';
import { PhButton, PhIcon, PhInput, PhModal, useToast } from '@phishyhub/design-system';
import * as usersApi from '../../../../api/endpoints/users';
import * as channelsApi from '../../../../api/endpoints/channels';
import { useChannelsStore } from '../../../../stores/channels';
import { useAuthStore } from '../../../../stores/auth';
import { useUsersStore } from '../../../../stores/users';
import { isApiError } from '../../../../api/errors';
import UserAvatar from '../../../../components/shared/UserAvatar.vue';
import type { UserDTO } from '../../../../api/types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [channelId: string] }>();

const channelsStore = useChannelsStore();
const usersStore = useUsersStore();
const authStore = useAuthStore();
const toast = useToast();

const name = ref('');
const type = ref<'public' | 'private'>('public');
const creating = ref(false);

// Member picker — mirrors the established search-as-you-type pattern
// (usersApi.listUsers({q, pageSize:8}), 200ms debounce) already used by
// DmComposerDialog.vue/ChannelInfoPanel.vue.
const query = ref('');
const searchResults = ref<UserDTO[]>([]);
const searching = ref(false);
const selectedMembers = ref<UserDTO[]>([]);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      name.value = '';
      type.value = 'public';
      query.value = '';
      searchResults.value = [];
      selectedMembers.value = [];
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
      searchResults.value = items.filter(
        (u) => u.id !== authStore.user?.id && !selectedMembers.value.some((m) => m.id === u.id),
      );
    } catch {
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  }, 200);
});

function addMember(user: UserDTO): void {
  selectedMembers.value = [...selectedMembers.value, user];
  searchResults.value = searchResults.value.filter((u) => u.id !== user.id);
  usersStore.upsert(user);
}

function removeMember(userId: string): void {
  selectedMembers.value = selectedMembers.value.filter((u) => u.id !== userId);
}

async function onCreate(): Promise<void> {
  const trimmed = name.value.trim();
  if (!trimmed) return;
  creating.value = true;
  try {
    const channel = await channelsApi.createChannel({
      type: type.value,
      name: trimmed,
      memberIds: selectedMembers.value.map((u) => u.id),
    });
    channelsStore.upsertChannel({ ...channel, unreadCount: 0, lastReadMessageId: null, lastMessage: null });
    emit('created', channel.id);
    emit('update:modelValue', false);
    toast.push({ title: 'Channel created', variant: 'success' });
  } catch (err) {
    toast.push({
      title: 'Could not create channel',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <PhModal :model-value="modelValue" title="Create a channel" size="sm" @update:model-value="emit('update:modelValue', $event)">
    <div class="channel-create-dialog">
      <label class="channel-create-dialog__field">
        <span class="channel-create-dialog__label">Name</span>
        <PhInput v-model="name" placeholder="e.g. product-launch" @keydown.enter="onCreate" />
      </label>

      <div class="channel-create-dialog__field">
        <span class="channel-create-dialog__label">Visibility</span>
        <div class="channel-create-dialog__toggle" role="radiogroup" aria-label="Visibility">
          <button
            type="button"
            class="channel-create-dialog__toggle-btn"
            :class="{ 'channel-create-dialog__toggle-btn--active': type === 'public' }"
            role="radio"
            :aria-checked="type === 'public'"
            @click="type = 'public'"
          >
            <PhIcon name="Hash" size="xs" />
            Public
          </button>
          <button
            type="button"
            class="channel-create-dialog__toggle-btn"
            :class="{ 'channel-create-dialog__toggle-btn--active': type === 'private' }"
            role="radio"
            :aria-checked="type === 'private'"
            @click="type = 'private'"
          >
            <PhIcon name="Lock" size="xs" />
            Private
          </button>
        </div>
        <p class="channel-create-dialog__hint">
          {{ type === 'public' ? 'Anyone in the workspace can find and join this channel.' : 'Only invited people can see and join this channel.' }}
        </p>
      </div>

      <div class="channel-create-dialog__field">
        <span class="channel-create-dialog__label">Add people <span class="channel-create-dialog__label-optional">(optional)</span></span>

        <div v-if="selectedMembers.length" class="channel-create-dialog__chips">
          <span v-for="user in selectedMembers" :key="user.id" class="channel-create-dialog__chip">
            <UserAvatar :user-id="user.id" size="xs" />
            {{ user.firstName }} {{ user.lastName }}
            <button
              type="button"
              class="channel-create-dialog__chip-remove"
              :aria-label="`Remove ${user.firstName} ${user.lastName}`"
              @click="removeMember(user.id)"
            >
              <PhIcon name="X" size="xs" />
            </button>
          </span>
        </div>

        <PhInput v-model="query" placeholder="Search people by name or email…" />

        <ul v-if="searchResults.length" class="channel-create-dialog__results">
          <li
            v-for="user in searchResults"
            :key="user.id"
            class="channel-create-dialog__result"
            @click="addMember(user)"
          >
            <UserAvatar :user-id="user.id" size="sm" />
            <span>{{ user.firstName }} {{ user.lastName }}</span>
            <PhIcon name="Plus" size="sm" class="channel-create-dialog__result-icon" />
          </li>
        </ul>
        <p v-else-if="searching" class="channel-create-dialog__hint">Searching…</p>
      </div>
    </div>

    <template #footer>
      <PhButton variant="ghost" @click="emit('update:modelValue', false)">Cancel</PhButton>
      <PhButton :loading="creating" :disabled="!name.trim()" @click="onCreate">Create</PhButton>
    </template>
  </PhModal>
</template>

<style scoped>
.channel-create-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-5);
}

.channel-create-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
}

.channel-create-dialog__label {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-default);
}

.channel-create-dialog__label-optional {
  font-weight: var(--ph-font-weight-normal);
  color: var(--ph-color-text-subtle);
}

.channel-create-dialog__hint {
  margin: 0;
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}

.channel-create-dialog__toggle {
  display: inline-flex;
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-md);
  overflow: hidden;
  width: fit-content;
}

.channel-create-dialog__toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  padding: var(--ph-space-2) var(--ph-space-4);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
  transition:
    background-color var(--ph-duration-fast) var(--ph-easing-standard),
    color var(--ph-duration-fast) var(--ph-easing-standard);
}

.channel-create-dialog__toggle-btn:hover:not(.channel-create-dialog__toggle-btn--active) {
  background-color: var(--ph-color-surface-hover);
}

.channel-create-dialog__toggle-btn--active {
  background-color: var(--ph-color-accent);
  color: var(--ph-color-text-on-accent);
}

.channel-create-dialog__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ph-space-1);
}

.channel-create-dialog__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  padding: 2px var(--ph-space-2) 2px 2px;
  border-radius: var(--ph-radius-full);
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
  font-size: var(--ph-font-size-sm);
}

.channel-create-dialog__chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  opacity: 0.7;
  border-radius: var(--ph-radius-full);
}

.channel-create-dialog__chip-remove:hover {
  opacity: 1;
}

.channel-create-dialog__results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
}

.channel-create-dialog__result {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  cursor: pointer;
}

.channel-create-dialog__result:hover {
  background-color: var(--ph-color-surface-hover);
}

.channel-create-dialog__result span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-create-dialog__result-icon {
  color: var(--ph-color-text-muted);
}
</style>
