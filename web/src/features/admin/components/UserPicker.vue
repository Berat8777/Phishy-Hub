<script setup lang="ts">
/**
 * Search-as-you-type user picker — mirrors
 * `features/boards/components/AssigneePicker.vue`'s exact pattern
 * (`usersApi.listUsers({ q, pageSize: 8 })`, 150ms debounce) per the
 * architect's call to reuse that prior art rather than adding a "list all
 * users" store action. A separate component (not a direct import of
 * AssigneePicker) since that lives in the boards feature, which this pass
 * was told not to touch/couple to, and its prop type (`TicketPersonDTO`)
 * doesn't carry `email`, which this picker's caller (`DepartmentDialog`)
 * wants to show for disambiguation.
 */
import { ref, watch } from 'vue';
import { PhIcon, PhInput, PhPopover } from '@phishyhub/design-system';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import * as usersApi from '../../../api/endpoints/users';
import type { UserDTO } from '../../../api/types';

const props = defineProps<{ selected: UserDTO | null; placeholder?: string; clearable?: boolean }>();
const emit = defineEmits<{ select: [userId: string | null] }>();

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
  emit('select', user.id);
  close();
}

function clear(close: () => void): void {
  emit('select', null);
  close();
}
</script>

<template>
  <PhPopover v-model="open">
    <template #trigger>
      <button type="button" class="user-picker__trigger">
        <template v-if="selected">
          <UserAvatar :user-id="selected.id" size="sm" />
          <span>{{ selected.firstName }} {{ selected.lastName }}</span>
        </template>
        <template v-else>
          <PhIcon name="Search" size="sm" />
          <span>{{ placeholder ?? 'Search people…' }}</span>
        </template>
      </button>
    </template>

    <template #default="{ close }">
      <div class="user-picker__panel">
        <PhInput v-model="query" placeholder="Search people…" />
        <ul class="user-picker__list" role="listbox">
          <li v-if="selected && clearable !== false">
            <button type="button" class="user-picker__item" @click="clear(close)">
              <PhIcon name="X" size="xs" /> Clear
            </button>
          </li>
          <li v-for="user in results" :key="user.id">
            <button type="button" class="user-picker__item" @click="select(user, close)">
              <UserAvatar :user-id="user.id" size="xs" />
              <span>{{ user.firstName }} {{ user.lastName }}</span>
              <span class="user-picker__email">{{ user.email }}</span>
            </button>
          </li>
          <li v-if="results.length === 0" class="user-picker__empty">No matches</li>
        </ul>
      </div>
    </template>
  </PhPopover>
</template>

<style scoped>
.user-picker__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-2);
  width: 100%;
  height: 40px;
  padding: 0 var(--ph-space-3);
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
}

.user-picker__trigger:hover {
  background-color: var(--ph-color-surface-hover);
}

.user-picker__panel {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
  width: 260px;
}

.user-picker__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}

.user-picker__item {
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

.user-picker__item:hover {
  background-color: var(--ph-color-surface-hover);
}

.user-picker__email {
  margin-left: auto;
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-picker__empty {
  padding: var(--ph-space-2);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-subtle);
}
</style>
