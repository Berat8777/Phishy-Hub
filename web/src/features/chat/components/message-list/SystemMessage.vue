<script setup lang="ts">
import { computed } from 'vue';
import { formatTime } from '../../../../lib/date';
import type { MessageDTO } from '../../../../api/types';

const props = defineProps<{ message: MessageDTO }>();
const time = computed(() => formatTime(props.message.createdAt));
</script>

<template>
  <div class="system-message" :id="`message-${message.id}`">
    <span class="system-message__text">{{ message.body }}</span>
    <span class="system-message__time">{{ time }}</span>
  </div>
</template>

<style scoped>
.system-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-1) var(--ph-space-4);
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
  text-align: center;
}
</style>
