<script setup lang="ts">
import { ref, watch } from 'vue';
import { PhIcon, PhInput, PhPopover } from '@phishyhub/design-system';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import * as usersApi from '../../../api/endpoints/users';
import type { TicketPersonDTO, UserDTO } from '../../../api/types';

/**
 * Search-as-you-type against `GET /users?q=` (CONTRACT.md §3.3) — mirrors
 * `MentionAutocomplete.vue`'s exact pattern (`usersApi.listUsers({ q,
 * pageSize: 8 })`, 150ms debounce) rather than a "list all users" store
 * action, per the architect's explicit call to reuse that prior art.
 */
const props = defineProps<{ assignee: TicketPersonDTO | null }>();
const emit = defineEmits<{ assign: [userId: string | null] }>();

const open = ref(false);
const query = ref('');
const results = ref<UserDTO[]>([]);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function search(q: string): Promise<void> {
  try {
    const { items } = await usersApi.listUsers({ q, pageSize: 8 });
    results.value = items;
  } catch {
    results.value = [];
  }
}

watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void search(q), 150);
});

watch(open, (isOpen) => {
  if (isOpen) {
    query.value = '';
    void search('');
  }
});

function select(user: UserDTO, close: () => void): void {
  emit('assign', user.id);
  close();
}

function unassign(close: () => void): void {
  emit('assign', null);
  close();
}
</script>

<template>
  <PhPopover v-model="open">
    <template #trigger>
      <button type="button" class="assignee-picker__trigger">
        <template v-if="assignee">
          <UserAvatar :user-id="assignee.id" size="sm" />
          <span>{{ assignee.firstName }} {{ assignee.lastName }}</span>
        </template>
        <template v-else>
          <PhIcon name="UserPlus" size="sm" />
          <span>Unassigned</span>
        </template>
      </button>
    </template>

    <template #default="{ close }">
      <div class="assignee-picker__panel">
        <PhInput v-model="query" placeholder="Search people…" />
        <ul class="assignee-picker__list" role="listbox">
          <li v-if="assignee">
            <button type="button" class="assignee-picker__item" @click="unassign(close)">
              <PhIcon name="X" size="xs" /> Unassign
            </button>
          </li>
          <li v-for="user in results" :key="user.id">
            <button type="button" class="assignee-picker__item" @click="select(user, close)">
              <UserAvatar :user-id="user.id" size="xs" />
              <span>{{ user.firstName }} {{ user.lastName }}</span>
            </button>
          </li>
          <li v-if="results.length === 0" class="assignee-picker__empty">No matches</li>
        </ul>
      </div>
    </template>
  </PhPopover>
</template>

<style scoped>
.assignee-picker__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-1) var(--ph-space-2);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
}

.assignee-picker__trigger:hover {
  background-color: var(--ph-color-surface-hover);
}

.assignee-picker__panel {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
  width: 240px;
}

.assignee-picker__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}

.assignee-picker__item {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  width: 100%;
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-sm);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  text-align: left;
}

.assignee-picker__item:hover {
  background-color: var(--ph-color-surface-hover);
}

.assignee-picker__empty {
  padding: var(--ph-space-2);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-subtle);
}
</style>
