<script setup lang="ts">
import { computed, ref } from 'vue';
import { PhIcon, PhSpinner, useToast } from '@phishyhub/design-system';
import { formatTime } from '../../../../lib/date';
import { useMessagesStore } from '../../../../stores/messages';
import { useAiStore } from '../../../../stores/ai';
import { isApiError } from '../../../../api/errors';
import MessageBody from './MessageBody.vue';
import MessageAttachments from './MessageAttachments.vue';
import MessageReactions from './MessageReactions.vue';
import MessageHoverActions from './MessageHoverActions.vue';
import MessageEditor from './MessageEditor.vue';
import type { ClientMessage } from '../../../../stores/messages';

const props = withDefaults(
  defineProps<{
    message: ClientMessage;
    currentUserId: string;
    currentUserRole: string;
    allowThreadReply: boolean;
    highlighted?: boolean;
    /** False for the first message in a MessageGroup — the group header already shows that timestamp. */
    showTimestamp?: boolean;
  }>(),
  { highlighted: false, showTimestamp: true },
);

const emit = defineEmits<{ reply: [messageId: string] }>();

const messagesStore = useMessagesStore();
const aiStore = useAiStore();
const toast = useToast();

/**
 * `@ai` bot answer actively streaming into this message (Phase 6 / Module
 * 7) — `ai:answer:start`/`delta` key `streamingByMessageId` by this exact
 * message id (eventBridge.ts -> stores/ai.ts), and `ai:answer:done` deletes
 * the entry so this falls back to the finalized `message.body` again.
 *
 * Simplification (noted for review): while streaming, this renders as plain
 * text with a trailing caret instead of running the buffer through
 * MessageBody's mention-chip/link parsing — a partial `<@uuid>` token mid-
 * stream would render as broken/unresolved markup, so plain text avoids
 * flashing incorrect chips every delta. The final `message.body` (post
 * `ai:answer:done`) still gets full MessageBody rendering as normal.
 */
const isStreaming = computed(() => props.message.id in aiStore.streamingByMessageId);
const streamingText = computed(() => aiStore.streamingByMessageId[props.message.id] ?? '');

const editing = ref(false);
const saving = ref(false);

const canEdit = computed(
  () => props.message.status === 'sent' && (props.message.senderId === props.currentUserId || props.currentUserRole === 'admin'),
);

function isReactedByMe(emoji: string): boolean {
  const group = props.message.reactions.find((r) => r.emoji === emoji);
  return group ? group.userIds.includes(props.currentUserId) : false;
}

async function onReact(emoji: string): Promise<void> {
  try {
    await messagesStore.toggleReaction(props.message.id, emoji, isReactedByMe(emoji));
  } catch (err) {
    toast.push({ title: 'Could not react', description: describeError(err), variant: 'danger' });
  }
}

function onReactionPillToggle(emoji: string): void {
  void onReact(emoji);
}

async function onSaveEdit(body: string): Promise<void> {
  saving.value = true;
  try {
    await messagesStore.editMessage(props.message.id, body);
    editing.value = false;
  } catch (err) {
    toast.push({ title: 'Could not save edit', description: describeError(err), variant: 'danger' });
  } finally {
    saving.value = false;
  }
}

async function onDelete(): Promise<void> {
  if (!window.confirm('Delete this message? This cannot be undone.')) return;
  try {
    await messagesStore.removeMessage(props.message.id, props.message.channelId);
  } catch (err) {
    toast.push({ title: 'Could not delete message', description: describeError(err), variant: 'danger' });
  }
}

async function onRetry(): Promise<void> {
  const { id, channelId, body, replyToMessageId } = props.message;
  messagesStore.discardFailed(id);
  try {
    await messagesStore.sendMessage(channelId, { body: body ?? undefined, replyToMessageId: replyToMessageId ?? undefined });
  } catch {
    // sendMessage already re-marks the new optimistic row 'failed' on error.
  }
}

function describeError(err: unknown): string {
  return isApiError(err) ? err.message : 'Something went wrong.';
}
</script>

<template>
  <div
    :id="`message-${message.id}`"
    class="message-item"
    :class="{
      'message-item--sending': message.status === 'sending',
      'message-item--failed': message.status === 'failed',
      'message-item--highlighted': highlighted,
    }"
  >
    <MessageEditor v-if="editing" :initial-body="message.body ?? ''" :saving="saving" @save="onSaveEdit" @cancel="editing = false" />

    <template v-else>
      <div class="message-item__row">
        <span v-if="isStreaming" class="message-item__streaming">{{ streamingText }}<span class="message-item__caret" aria-hidden="true" /></span>
        <MessageBody v-else :body="message.body" />
        <span v-if="showTimestamp" class="message-item__time" :title="message.createdAt">{{ formatTime(message.createdAt) }}</span>
        <span v-if="message.editedAt" class="message-item__edited">(edited)</span>
        <PhSpinner v-if="message.status === 'sending'" size="sm" class="message-item__status-icon" />

        <MessageHoverActions
          v-if="message.status === 'sent'"
          class="message-item__hover-actions"
          :can-edit="canEdit"
          :allow-thread-reply="allowThreadReply"
          @react="onReact"
          @reply="emit('reply', message.id)"
          @edit="editing = true"
          @delete="onDelete"
        />
      </div>

      <MessageAttachments v-if="message.attachments.length" :attachments="message.attachments" />
      <MessageReactions
        v-if="message.reactions.length"
        :reactions="message.reactions"
        :current-user-id="currentUserId"
        @toggle="onReactionPillToggle"
      />

      <button v-if="message.status === 'failed'" type="button" class="message-item__retry" @click="onRetry">
        <PhIcon name="AlertCircle" size="xs" />
        Failed to send &middot; tap to retry
      </button>

      <button
        v-if="allowThreadReply && message.replyCount > 0"
        type="button"
        class="message-item__thread-summary"
        @click="emit('reply', message.id)"
      >
        <PhIcon name="MessagesSquare" size="xs" />
        {{ message.replyCount }} {{ message.replyCount === 1 ? 'reply' : 'replies' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.message-item {
  position: relative;
  padding: 2px var(--ph-space-4);
  border-radius: var(--ph-radius-md);
}

.message-item:hover {
  background-color: var(--ph-color-surface-hover);
}

.message-item:hover .message-item__hover-actions {
  visibility: visible;
  opacity: 1;
}

.message-item--sending {
  opacity: 0.6;
}

.message-item--highlighted {
  background-color: var(--ph-color-accent-subtle);
}

.message-item__row {
  position: relative;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--ph-space-1) var(--ph-space-2);
}

.message-item__streaming {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--ph-color-text-default);
}

.message-item__caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background-color: var(--ph-color-accent);
  animation: ph-message-caret-blink 1s step-end infinite;
}

@keyframes ph-message-caret-blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

.message-item__time {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}

.message-item__edited {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}

.message-item__status-icon {
  color: var(--ph-color-text-subtle);
}

.message-item__hover-actions {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  top: -18px;
  right: 0;
  transition: opacity var(--ph-duration-fast) var(--ph-easing-standard);
}

.message-item__retry {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  margin-top: var(--ph-space-1);
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-danger);
}

.message-item__retry:hover {
  text-decoration: underline;
}

.message-item__thread-summary {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  margin-top: var(--ph-space-1);
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-accent);
}

.message-item__thread-summary:hover {
  text-decoration: underline;
}
</style>
