<script setup lang="ts">
import { ref, watch } from 'vue';
import { PhButton, PhInput, PhModal, useToast } from '@phishyhub/design-system';
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

const query = ref('');
const results = ref<UserDTO[]>([]);
const selected = ref<UserDTO[]>([]);
const creating = ref(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      query.value = '';
      results.value = [];
      selected.value = [];
    }
  },
);

watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    if (!q) {
      results.value = [];
      return;
    }
    try {
      const { items } = await usersApi.listUsers({ q, pageSize: 8 });
      results.value = items.filter((u) => u.id !== authStore.user?.id && !selected.value.some((s) => s.id === u.id));
    } catch {
      results.value = [];
    }
  }, 200);
});

function selectUser(user: UserDTO): void {
  selected.value = [...selected.value, user];
  results.value = results.value.filter((u) => u.id !== user.id);
  usersStore.upsert(user);
}

function removeSelected(userId: string): void {
  selected.value = selected.value.filter((u) => u.id !== userId);
}

async function onCreate(): Promise<void> {
  if (selected.value.length === 0) return;
  creating.value = true;
  try {
    // Get-or-create per CONTRACT.md §3.5 — caller is implicitly a member, only pass the OTHER user ids.
    const channel = await channelsApi.createOrGetDm(selected.value.map((u) => u.id));
    const existing = channelsStore.getChannel(channel.id);
    channelsStore.upsertChannel(existing ?? { ...channel, unreadCount: 0, lastReadMessageId: null, lastMessage: null });
    emit('created', channel.id);
    emit('update:modelValue', false);
  } catch (err) {
    toast.push({
      title: 'Could not start conversation',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <PhModal :model-value="modelValue" title="New direct message" size="sm" @update:model-value="emit('update:modelValue', $event)">
    <div class="dm-composer">
      <div v-if="selected.length" class="dm-composer__chips">
        <span v-for="user in selected" :key="user.id" class="dm-composer__chip">
          {{ user.firstName }} {{ user.lastName }}
          <button type="button" aria-label="Remove" @click="removeSelected(user.id)">&times;</button>
        </span>
      </div>

      <PhInput v-model="query" placeholder="Search people…" />

      <ul v-if="results.length" class="dm-composer__results">
        <li v-for="user in results" :key="user.id" class="dm-composer__result" @click="selectUser(user)">
          <UserAvatar :user-id="user.id" size="sm" />
          <span>{{ user.firstName }} {{ user.lastName }}</span>
        </li>
      </ul>
    </div>

    <template #footer>
      <PhButton variant="ghost" @click="emit('update:modelValue', false)">Cancel</PhButton>
      <PhButton :loading="creating" :disabled="selected.length === 0" @click="onCreate">Start conversation</PhButton>
    </template>
  </PhModal>
</template>

<style scoped>
.dm-composer {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-3);
}

.dm-composer__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ph-space-1);
}

.dm-composer__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  padding: 2px var(--ph-space-2);
  border-radius: var(--ph-radius-full);
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
  font-size: var(--ph-font-size-sm);
}

.dm-composer__chip button {
  color: inherit;
  font-size: var(--ph-font-size-md);
  line-height: 1;
}

.dm-composer__results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
}

.dm-composer__result {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  cursor: pointer;
}

.dm-composer__result:hover {
  background-color: var(--ph-color-surface-hover);
}
</style>
