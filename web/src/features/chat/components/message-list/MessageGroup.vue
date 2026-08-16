<script setup lang="ts">
import { computed } from 'vue';
import { formatTime } from '../../../../lib/date';
import UserAvatar from '../../../../components/shared/UserAvatar.vue';
import UserPopover from '../shared/UserPopover.vue';
import MessageItem from './MessageItem.vue';
import type { ClientMessage } from '../../../../stores/messages';

/** Consecutive messages from the same sender within ~5 minutes, collapsed under one avatar/name header. */
const props = defineProps<{
  senderId: string;
  messages: ClientMessage[];
  currentUserId: string;
  currentUserRole: string;
  allowThreadReply: boolean;
  highlightedMessageId?: string | null;
}>();

const emit = defineEmits<{ reply: [messageId: string] }>();

const senderName = computed(() => {
  const sender = props.messages[0]?.sender;
  return sender ? `${sender.firstName} ${sender.lastName}` : 'Unknown user';
});
</script>

<template>
  <div class="message-group">
    <div class="message-group__gutter">
      <UserPopover :user-id="senderId">
        <UserAvatar :user-id="senderId" size="md" />
      </UserPopover>
    </div>
    <div class="message-group__content">
      <div class="message-group__header">
        <span class="message-group__name">{{ senderName }}</span>
        <span class="message-group__time">{{ formatTime(messages[0].createdAt) }}</span>
      </div>
      <MessageItem
        v-for="(message, index) in messages"
        :key="message.id"
        :message="message"
        :current-user-id="currentUserId"
        :current-user-role="currentUserRole"
        :allow-thread-reply="allowThreadReply"
        :highlighted="message.id === highlightedMessageId"
        :show-timestamp="index > 0"
        @reply="emit('reply', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.message-group {
  display: flex;
  gap: var(--ph-space-3);
  padding: var(--ph-space-2) var(--ph-space-4) 0;
}

.message-group__gutter {
  flex: 0 0 auto;
  padding-top: 2px;
}

.message-group__content {
  flex: 1 1 auto;
  min-width: 0;
}

.message-group__header {
  display: flex;
  align-items: baseline;
  gap: var(--ph-space-2);
  margin-bottom: 2px;
}

.message-group__name {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.message-group__time {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}

.message-group__content :deep(.message-item) {
  padding-left: 0;
  padding-right: 0;
}
</style>
