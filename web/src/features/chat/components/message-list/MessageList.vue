<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { PhEmptyState, PhIcon, PhSpinner } from '@phishyhub/design-system';
import { useAuthStore } from '../../../../stores/auth';
import { useChannelsStore } from '../../../../stores/channels';
import { useMessagesStore } from '../../../../stores/messages';
import { useThreadsStore } from '../../../../stores/threads';
import DayDivider from './DayDivider.vue';
import NewMessagesDivider from './NewMessagesDivider.vue';
import SystemMessage from './SystemMessage.vue';
import MessageGroup from './MessageGroup.vue';
import type { ClientMessage } from '../../../../stores/messages';

export type ConversationSource = { kind: 'channel'; id: string } | { kind: 'thread'; id: string };

/**
 * Reusable message pane driven by a conversation-source descriptor rather
 * than a bare channelId — this is what lets ThreadPanel.vue reuse this
 * exact component (`source: { kind: 'thread', id: rootMessageId }`) instead
 * of forking a parallel implementation. No virtualization: the underlying
 * stores already cap in-memory history per channel/thread, this component
 * only owns scroll mechanics (anchor-preserving prepend on backward
 * pagination, stick-to-bottom on new messages, a "N new messages" pill
 * otherwise).
 */
const props = defineProps<{ source: ConversationSource }>();

const emit = defineEmits<{ reply: [messageId: string] }>();

const authStore = useAuthStore();
const channelsStore = useChannelsStore();
const messagesStore = useMessagesStore();
const threadsStore = useThreadsStore();

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const STICK_THRESHOLD_PX = 80;
const LOAD_MORE_TRIGGER_PX = 120;

const scrollRef = ref<HTMLElement | null>(null);
const isNearBottom = ref(true);
const pendingNewCount = ref(0);
const flashedMessageId = ref<string | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | null = null;

const currentUserId = computed(() => authStore.user?.id ?? '');
const currentUserRole = computed(() => authStore.user?.role ?? '');

const messages = computed<ClientMessage[]>(() =>
  props.source.kind === 'channel' ? messagesStore.getMessages(props.source.id) : threadsStore.getReplies(props.source.id),
);
const hasMore = computed(() =>
  props.source.kind === 'channel' ? messagesStore.hasMore(props.source.id) : threadsStore.hasMore(props.source.id),
);
const loading = computed(() =>
  props.source.kind === 'channel' ? messagesStore.isLoading(props.source.id) : threadsStore.isLoading(props.source.id),
);
const newestId = computed(() => {
  const list = messages.value;
  return list.length ? list[list.length - 1].id : null;
});

const lastReadMessageId = computed(() => {
  if (props.source.kind !== 'channel') return null;
  return channelsStore.getChannel(props.source.id)?.lastReadMessageId ?? null;
});
const firstUnreadId = computed(() => {
  const lastRead = lastReadMessageId.value;
  if (!lastRead) return null;
  const idx = messages.value.findIndex((m) => m.id === lastRead);
  if (idx === -1) return null;
  return messages.value[idx + 1]?.id ?? null;
});

type RenderItem =
  | { kind: 'day'; key: string; date: string }
  | { kind: 'unread'; key: string }
  | { kind: 'system'; key: string; message: ClientMessage }
  | { kind: 'group'; key: string; senderId: string; messages: ClientMessage[] };

const renderItems = computed<RenderItem[]>(() => {
  const items: RenderItem[] = [];
  let lastDay = '';
  let currentGroup: ClientMessage[] = [];
  let unreadInserted = props.source.kind !== 'channel';

  function flushGroup(): void {
    if (currentGroup.length) {
      items.push({ kind: 'group', key: currentGroup[0].id, senderId: currentGroup[0].senderId, messages: currentGroup });
    }
    currentGroup = [];
  }

  for (const message of messages.value) {
    const day = new Date(message.createdAt).toDateString();
    if (day !== lastDay) {
      flushGroup();
      items.push({ kind: 'day', key: `day-${day}`, date: message.createdAt });
      lastDay = day;
    }

    if (!unreadInserted && message.id === firstUnreadId.value) {
      flushGroup();
      items.push({ kind: 'unread', key: 'unread-divider' });
      unreadInserted = true;
    }

    if (message.type === 'system') {
      flushGroup();
      items.push({ kind: 'system', key: message.id, message });
      continue;
    }

    const last = currentGroup[currentGroup.length - 1];
    if (
      last &&
      last.senderId === message.senderId &&
      new Date(message.createdAt).getTime() - new Date(last.createdAt).getTime() < GROUP_WINDOW_MS
    ) {
      currentGroup.push(message);
    } else {
      flushGroup();
      currentGroup = [message];
    }
  }
  flushGroup();

  return items;
});

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

function scrollToBottom(smooth = false): void {
  const el = scrollRef.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  pendingNewCount.value = 0;
  isNearBottom.value = true;
}

async function ensureInitialLoad(): Promise<void> {
  if (props.source.kind === 'channel') {
    if (messagesStore.getMessages(props.source.id).length === 0) {
      await messagesStore.fetchMessages(props.source.id);
    }
  } else if (threadsStore.getReplies(props.source.id).length === 0) {
    await threadsStore.fetchReplies(props.source.id);
  }
}

function loadOlder(before: string): Promise<void> {
  return props.source.kind === 'channel'
    ? messagesStore.fetchMessages(props.source.id, { before })
    : threadsStore.fetchReplies(props.source.id, { before });
}

async function loadOlderPreservingScroll(): Promise<void> {
  const el = scrollRef.value;
  const oldestId = messages.value[0]?.id;
  if (!el || !oldestId) return;
  const prevHeight = el.scrollHeight;
  const prevTop = el.scrollTop;
  await loadOlder(oldestId);
  await nextTick();
  el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
}

function onScroll(): void {
  const el = scrollRef.value;
  if (!el) return;
  isNearBottom.value = distanceFromBottom(el) < STICK_THRESHOLD_PX;
  if (isNearBottom.value) pendingNewCount.value = 0;
  if (el.scrollTop < LOAD_MORE_TRIGGER_PX && hasMore.value && !loading.value) {
    void loadOlderPreservingScroll();
  }
}

function flashHighlight(messageId: string): void {
  flashedMessageId.value = messageId;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flashedMessageId.value = null;
  }, 2000);
}

/** Scrolls to (and briefly highlights) a message — loading older pages first if it isn't in the currently-loaded window yet. Used by SearchPanel result clicks. */
async function scrollToMessage(messageId: string): Promise<void> {
  let attempts = 0;
  while (!messages.value.some((m) => m.id === messageId) && hasMore.value && attempts < 10) {
    const oldestId = messages.value[0]?.id;
    if (!oldestId) break;
    await loadOlder(oldestId);
    attempts += 1;
  }
  await nextTick();
  const el = document.getElementById(`message-${messageId}`);
  if (el) {
    el.scrollIntoView({ block: 'center' });
    flashHighlight(messageId);
  }
}

defineExpose({ scrollToMessage, scrollToBottom });

watch(newestId, async (id, previousId) => {
  if (!id || id === previousId) return;
  await nextTick();
  if (isNearBottom.value) {
    scrollToBottom();
  } else {
    pendingNewCount.value += 1;
  }
});

// Best-effort read-receipt: mark the channel read up to the newest CONFIRMED
// (non-optimistic, non-failed) message whenever the user is at (or returns
// to) the bottom of a channel's timeline. Not applicable to thread sources
// — CONTRACT.md's `message:read` is channel-scoped only.
watch([newestId, isNearBottom], async ([id, atBottom]) => {
  if (props.source.kind !== 'channel' || !id || !atBottom) return;
  const message = messagesStore.byId.get(id);
  if (!message || message.status !== 'sent') return;
  if (channelsStore.getChannel(props.source.id)?.lastReadMessageId === id) return;
  try {
    await channelsStore.markRead(props.source.id, id);
  } catch {
    // Best-effort — badge just stays stale until the next successful mark.
  }
});

watch(
  () => `${props.source.kind}:${props.source.id}`,
  async () => {
    pendingNewCount.value = 0;
    isNearBottom.value = true;
    await ensureInitialLoad();
    await nextTick();
    scrollToBottom();
  },
  { immediate: true },
);

onMounted(async () => {
  await nextTick();
  scrollToBottom();
});
</script>

<template>
  <div class="message-list">
    <div ref="scrollRef" class="message-list__scroll" @scroll="onScroll">
      <div v-if="loading && messages.length === 0" class="message-list__loading">
        <PhSpinner />
      </div>

      <PhEmptyState
        v-else-if="messages.length === 0"
        title="No messages yet"
        :description="source.kind === 'thread' ? 'Be the first to reply.' : 'Say hello to get the conversation started.'"
      >
        <template #icon>
          <PhIcon name="MessageSquare" size="xl" />
        </template>
      </PhEmptyState>

      <template v-else>
        <div v-if="loading" class="message-list__loading-more"><PhSpinner size="sm" /></div>

        <template v-for="item in renderItems" :key="item.key">
          <DayDivider v-if="item.kind === 'day'" :date="item.date" />
          <NewMessagesDivider v-else-if="item.kind === 'unread'" />
          <SystemMessage v-else-if="item.kind === 'system'" :message="item.message" />
          <MessageGroup
            v-else
            :sender-id="item.senderId"
            :messages="item.messages"
            :current-user-id="currentUserId"
            :current-user-role="currentUserRole"
            :allow-thread-reply="source.kind === 'channel'"
            :highlighted-message-id="flashedMessageId"
            @reply="emit('reply', $event)"
          />
        </template>

        <div class="message-list__bottom-spacer" />
      </template>
    </div>

    <button v-if="pendingNewCount > 0" type="button" class="message-list__jump" @click="scrollToBottom(true)">
      {{ pendingNewCount }} new message{{ pendingNewCount > 1 ? 's' : '' }}
      <PhIcon name="ArrowDown" size="xs" />
    </button>
  </div>
</template>

<style scoped>
.message-list {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.message-list__scroll {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--ph-color-border-strong) transparent;
}

.message-list__scroll::-webkit-scrollbar {
  width: 8px;
}

.message-list__scroll::-webkit-scrollbar-thumb {
  background-color: var(--ph-color-border-strong);
  border-radius: var(--ph-radius-full);
}

.message-list__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.message-list__loading-more {
  display: flex;
  justify-content: center;
  padding: var(--ph-space-2);
}

.message-list__bottom-spacer {
  height: var(--ph-space-3);
}

.message-list__jump {
  position: absolute;
  bottom: var(--ph-space-3);
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  padding: var(--ph-space-1) var(--ph-space-3);
  border-radius: var(--ph-radius-full);
  background-color: var(--ph-color-accent);
  color: var(--ph-color-text-on-accent);
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-medium);
  box-shadow: var(--ph-shadow-md);
}

.message-list__jump:hover {
  background-color: var(--ph-color-accent-hover);
}
</style>
