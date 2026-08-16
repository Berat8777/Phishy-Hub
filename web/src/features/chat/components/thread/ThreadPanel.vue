<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PhIcon } from '@phishyhub/design-system';
import { useMessagesStore } from '../../../../stores/messages';
import { useAuthStore } from '../../../../stores/auth';
import MessageList from '../message-list/MessageList.vue';
import MessageGroup from '../message-list/MessageGroup.vue';
import MessageComposer from '../composer/MessageComposer.vue';
import DropZone from '../composer/DropZone.vue';

/** Rendered into the `aside` named view (router/index.ts, chat-thread route). Reuses MessageList with source {kind:'thread', id: rootMessageId} instead of forking a parallel implementation. */
const props = defineProps<{ channelId: string; rootMessageId: string }>();
const emit = defineEmits<{ close: [] }>();

const messagesStore = useMessagesStore();
const authStore = useAuthStore();
const composerRef = ref<InstanceType<typeof MessageComposer> | null>(null);

const rootMessage = computed(() => messagesStore.getMessage(props.rootMessageId));

function onDropFiles(files: File[]): void {
  composerRef.value?.addFiles(files);
}

/**
 * CONTRACT.md has no `GET /messages/:id` — a single message can only be
 * fetched by loading the page of channel messages that contains it. Thread
 * roots are always top-level messages, so re-fetching the channel's first
 * page covers the common case; a root older than that page won't resolve
 * here (known limitation, not silently masked — the panel still works, it
 * just won't render the pinned root message preview in that edge case).
 */
async function ensureRootMessage(): Promise<void> {
  if (messagesStore.getMessage(props.rootMessageId)) return;
  await messagesStore.fetchMessages(props.channelId);
}

onMounted(ensureRootMessage);
watch(() => props.rootMessageId, ensureRootMessage);
</script>

<template>
  <DropZone class="thread-panel__dropzone" @drop-files="onDropFiles">
    <div class="thread-panel">
      <header class="thread-panel__header">
        <h2 class="thread-panel__title"><PhIcon name="MessagesSquare" size="sm" /> Thread</h2>
        <button type="button" class="thread-panel__close" aria-label="Close thread" @click="emit('close')">
          <PhIcon name="X" size="sm" />
        </button>
      </header>

      <div v-if="rootMessage" class="thread-panel__root">
        <MessageGroup
          :sender-id="rootMessage.senderId"
          :messages="[rootMessage]"
          :current-user-id="authStore.user?.id ?? ''"
          :current-user-role="authStore.user?.role ?? ''"
          :allow-thread-reply="false"
        />
      </div>

      <MessageList :source="{ kind: 'thread', id: rootMessageId }" />
      <MessageComposer ref="composerRef" :channel-id="channelId" :reply-to-message-id="rootMessageId" placeholder="Reply…" />
    </div>
  </DropZone>
</template>

<style scoped>
.thread-panel__dropzone {
  display: contents;
}

.thread-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 360px;
  border-left: 1px solid var(--ph-color-border-subtle);
  background-color: var(--ph-color-surface-raised);
}

.thread-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: var(--ph-space-3) var(--ph-space-4);
  border-bottom: 1px solid var(--ph-color-border-subtle);
}

.thread-panel__title {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-2);
  margin: 0;
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.thread-panel__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
}

.thread-panel__close:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.thread-panel__root {
  flex-shrink: 0;
  padding-bottom: var(--ph-space-2);
  border-bottom: 1px solid var(--ph-color-border-subtle);
}
</style>
