<script setup lang="ts">
import { computed } from 'vue';
import { PhAvatar, PhBadge, PhIcon } from '@phishyhub/design-system';
import { useAuthStore } from '../../../../stores/auth';
import { useMessagesStore } from '../../../../stores/messages';
import { mentionToken } from '../../../../lib/mentions';
import { useChannelLabel } from '../../composables/useChannelLabel';
import PresenceDot from '../../../../components/shared/PresenceDot.vue';
import type { ChannelListItemDTO } from '../../../../api/types';

const props = defineProps<{ channel: ChannelListItemDTO; active: boolean }>();
const emit = defineEmits<{ click: [] }>();

const authStore = useAuthStore();
const messagesStore = useMessagesStore();

const isDm = computed(() => props.channel.type === 'dm');
const { label, otherMemberIds } = useChannelLabel(() => props.channel);

const initials = computed(() =>
  label.value
    .split(/\s+/)
    .map((part) => part.slice(0, 1))
    .join('')
    .slice(0, 2)
    .toUpperCase(),
);

const singleOtherUserId = computed(() => (otherMemberIds.value.length === 1 ? otherMemberIds.value[0] : null));

const preview = computed(() => {
  const last = props.channel.lastMessage;
  if (!last) return 'No messages yet';
  return last.body || 'Sent an attachment';
});

/**
 * Best-effort only: CONTRACT.md §9 point 7 — the server never parses or
 * tracks mentions, so "unread message that mentions me" can only be
 * detected against messages already cached client-side (previously loaded,
 * or received live over the socket this session). A channel that hasn't
 * been opened yet will under-report this — a known limitation of the
 * backend contract, not a bug here.
 */
const hasUnreadMention = computed(() => {
  if (props.channel.unreadCount === 0 || !authStore.user) return false;
  const token = mentionToken(authStore.user.id);
  const lastRead = props.channel.lastReadMessageId;
  let pastLastRead = !lastRead;
  for (const message of messagesStore.getMessages(props.channel.id)) {
    if (pastLastRead && message.senderId !== authStore.user.id && message.body?.includes(token)) return true;
    if (message.id === lastRead) pastLastRead = true;
  }
  return false;
});
</script>

<template>
  <button type="button" class="channel-list-item" :class="{ 'channel-list-item--active': active }" @click="emit('click')">
    <span class="channel-list-item__avatar">
      <PhAvatar v-if="isDm" :initials="initials" size="sm">
        <template v-if="singleOtherUserId" #presence>
          <PresenceDot :user-id="singleOtherUserId" />
        </template>
      </PhAvatar>
      <span v-else class="channel-list-item__hash"><PhIcon name="Hash" size="sm" /></span>
    </span>

    <span class="channel-list-item__body">
      <span class="channel-list-item__name">{{ label }}</span>
      <span class="channel-list-item__preview">{{ preview }}</span>
    </span>

    <span class="channel-list-item__badges">
      <PhBadge v-if="hasUnreadMention" variant="danger">@</PhBadge>
      <PhBadge v-if="channel.unreadCount > 0" variant="cta">{{ channel.unreadCount > 99 ? '99+' : channel.unreadCount }}</PhBadge>
    </span>
  </button>
</template>

<style scoped>
.channel-list-item {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  width: 100%;
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-md);
  text-align: left;
  transition: background-color var(--ph-duration-fast) var(--ph-easing-standard);
}

.channel-list-item:hover {
  background-color: var(--ph-color-surface-hover);
}

.channel-list-item--active {
  background-color: var(--ph-color-accent-subtle);
}

.channel-list-item:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.channel-list-item__avatar {
  flex-shrink: 0;
}

.channel-list-item__hash {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--ph-radius-full);
  background-color: var(--ph-color-surface-sunken);
  color: var(--ph-color-text-muted);
}

.channel-list-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.channel-list-item__name {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-list-item__preview {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-list-item__badges {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--ph-space-1);
}
</style>
