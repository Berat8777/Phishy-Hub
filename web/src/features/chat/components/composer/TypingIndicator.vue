<script setup lang="ts">
import { computed, watch } from 'vue';
import { useTypingStore } from '../../../../stores/typing';
import { useUsersStore } from '../../../../stores/users';

/** Reads the `typing` store only — never the socket directly (repo rule). */
const props = defineProps<{ channelId: string }>();

const typingStore = useTypingStore();
const usersStore = useUsersStore();

const typingUserIds = computed(() => typingStore.typingUserIds(props.channelId));

watch(
  typingUserIds,
  async (ids) => {
    await Promise.all(
      ids.map(async (id) => {
        if (usersStore.getUser(id)) return;
        try {
          await usersStore.fetchUser(id);
        } catch {
          // Falls back to "Someone" below.
        }
      }),
    );
  },
  { immediate: true },
);

function nameFor(id: string): string {
  return usersStore.getUser(id)?.firstName ?? 'Someone';
}

const label = computed(() => {
  const ids = typingUserIds.value;
  if (ids.length === 0) return '';
  if (ids.length === 1) return `${nameFor(ids[0])} is typing…`;
  if (ids.length === 2) return `${nameFor(ids[0])} and ${nameFor(ids[1])} are typing…`;
  return 'Several people are typing…';
});
</script>

<template>
  <p class="typing-indicator" :class="{ 'typing-indicator--visible': label }">{{ label || ' ' }}</p>
</template>

<style scoped>
.typing-indicator {
  margin: 0;
  padding: 0 var(--ph-space-4);
  height: 18px;
  font-size: var(--ph-font-size-xs);
  font-style: italic;
  color: var(--ph-color-text-subtle);
  overflow: hidden;
}
</style>
