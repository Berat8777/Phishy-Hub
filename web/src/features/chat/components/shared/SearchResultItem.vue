<script setup lang="ts">
import { computed } from 'vue';
import { formatRelative } from '../../../../lib/date';
import UserAvatar from '../../../../components/shared/UserAvatar.vue';
import type { MessageDTO } from '../../../../api/types';

const props = defineProps<{ message: MessageDTO; channelLabel?: string }>();
const emit = defineEmits<{ click: [] }>();

const senderName = computed(() =>
  props.message.sender ? `${props.message.sender.firstName} ${props.message.sender.lastName}` : 'Unknown user',
);
</script>

<template>
  <button type="button" class="search-result-item" @click="emit('click')">
    <UserAvatar :user-id="message.senderId" size="sm" />
    <span class="search-result-item__body">
      <span class="search-result-item__header">
        <span class="search-result-item__sender">{{ senderName }}</span>
        <span v-if="channelLabel" class="search-result-item__channel">in {{ channelLabel }}</span>
        <span class="search-result-item__time">{{ formatRelative(message.createdAt) }}</span>
      </span>
      <span class="search-result-item__snippet">{{ message.body || 'Sent an attachment' }}</span>
    </span>
  </button>
</template>

<style scoped>
.search-result-item {
  display: flex;
  align-items: flex-start;
  gap: var(--ph-space-2);
  width: 100%;
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-md);
  text-align: left;
}

.search-result-item:hover {
  background-color: var(--ph-color-surface-hover);
}

.search-result-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-result-item__header {
  display: flex;
  align-items: baseline;
  gap: var(--ph-space-2);
}

.search-result-item__sender {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.search-result-item__channel {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}

.search-result-item__time {
  margin-left: auto;
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
  flex-shrink: 0;
}

.search-result-item__snippet {
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
