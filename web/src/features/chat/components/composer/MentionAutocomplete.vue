<script setup lang="ts">
import { ref, watch } from 'vue';
import * as usersApi from '../../../../api/endpoints/users';
import UserAvatar from '../../../../components/shared/UserAvatar.vue';
import type { UserDTO } from '../../../../api/types';

/** Search-as-you-type against `GET /users?q=` (CONTRACT.md §3.3), triggered by ComposerInput on an `@` token. Keyboard nav is driven from the parent via defineExpose (ComposerInput owns the textarea's keydown handler). */
const props = defineProps<{ query: string }>();
const emit = defineEmits<{ select: [user: UserDTO] }>();

const results = ref<UserDTO[]>([]);
const activeIndex = ref(0);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function search(q: string): Promise<void> {
  try {
    const { items } = await usersApi.listUsers({ q, pageSize: 8 });
    results.value = items;
    activeIndex.value = 0;
  } catch {
    results.value = [];
  }
}

watch(
  () => props.query,
  (q) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void search(q), 150);
  },
  { immediate: true },
);

function moveNext(): void {
  if (results.value.length === 0) return;
  activeIndex.value = (activeIndex.value + 1) % results.value.length;
}

function movePrev(): void {
  if (results.value.length === 0) return;
  activeIndex.value = (activeIndex.value - 1 + results.value.length) % results.value.length;
}

function selectActive(): boolean {
  const user = results.value[activeIndex.value];
  if (!user) return false;
  emit('select', user);
  return true;
}

defineExpose({ moveNext, movePrev, selectActive });
</script>

<template>
  <ul v-if="results.length" class="mention-autocomplete" role="listbox">
    <li
      v-for="(user, index) in results"
      :key="user.id"
      class="mention-autocomplete__item"
      :class="{ 'mention-autocomplete__item--active': index === activeIndex }"
      role="option"
      :aria-selected="index === activeIndex"
      @mousedown.prevent="emit('select', user)"
      @mouseenter="activeIndex = index"
    >
      <UserAvatar :user-id="user.id" size="xs" />
      <span>{{ user.firstName }} {{ user.lastName }}</span>
    </li>
  </ul>
</template>

<style scoped>
.mention-autocomplete {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mention-autocomplete__item {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-1) var(--ph-space-2);
  border-radius: var(--ph-radius-sm);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  cursor: pointer;
}

.mention-autocomplete__item--active {
  background-color: var(--ph-color-accent-subtle);
}
</style>
