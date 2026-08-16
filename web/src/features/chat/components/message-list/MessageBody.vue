<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue';
import { parseBodySegments } from '../../../../lib/mentions';
import { useUsersStore } from '../../../../stores/users';

/**
 * Renders linkified URLs and Slack-style `<@uuid>` mention tokens as styled
 * "@DisplayName" chips (task brief mention format — CONTRACT.md §9 point 7:
 * the server never parses this, it's 100% client-side). Unresolved mentions
 * (fetch failed / user doesn't exist) fall back to the raw token.
 */
const props = defineProps<{ body: string | null }>();

const usersStore = useUsersStore();
const segments = computed(() => (props.body ? parseBodySegments(props.body) : []));
const failedIds = reactive(new Set<string>());

async function ensureMentionUsers(): Promise<void> {
  const ids = new Set(
    segments.value.filter((s): s is { type: 'mention'; userId: string } => s.type === 'mention').map((s) => s.userId),
  );
  await Promise.all(
    Array.from(ids).map(async (id) => {
      if (usersStore.getUser(id) || failedIds.has(id)) return;
      try {
        await usersStore.fetchUser(id);
      } catch {
        failedIds.add(id);
      }
    }),
  );
}

function mentionLabel(userId: string): string {
  const user = usersStore.getUser(userId);
  if (user) return `@${user.firstName} ${user.lastName}`;
  return `<@${userId}>`;
}

onMounted(ensureMentionUsers);
watch(() => props.body, ensureMentionUsers);
</script>

<template>
  <span class="message-body">
    <template v-for="(segment, index) in segments" :key="index">
      <a
        v-if="segment.type === 'link'"
        :href="segment.url"
        target="_blank"
        rel="noopener noreferrer"
        class="message-body__link"
        >{{ segment.url }}</a
      >
      <span
        v-else-if="segment.type === 'mention'"
        class="message-body__mention"
        :class="{ 'message-body__mention--unresolved': !usersStore.getUser(segment.userId) }"
        >{{ mentionLabel(segment.userId) }}</span
      >
      <template v-else>{{ segment.value }}</template>
    </template>
  </span>
</template>

<style scoped>
.message-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--ph-color-text-default);
}

.message-body__link {
  color: var(--ph-color-accent);
  text-decoration: underline;
}

.message-body__mention {
  display: inline;
  padding: 0 4px;
  border-radius: var(--ph-radius-sm);
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
  font-weight: var(--ph-font-weight-medium);
}

.message-body__mention--unresolved {
  background-color: var(--ph-color-surface-sunken);
  color: var(--ph-color-text-muted);
  font-weight: var(--ph-font-weight-regular);
}
</style>
