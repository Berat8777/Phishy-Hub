<script setup lang="ts">
import ChannelListItem from './ChannelListItem.vue';
import type { ChannelListItemDTO } from '../../../../api/types';

defineProps<{
  title: string;
  channels: ChannelListItemDTO[];
  activeChannelId: string | null;
}>();

const emit = defineEmits<{ select: [channelId: string] }>();
</script>

<template>
  <div v-if="channels.length" class="channel-section">
    <h3 class="channel-section__title">{{ title }}</h3>
    <ChannelListItem
      v-for="channel in channels"
      :key="channel.id"
      :channel="channel"
      :active="channel.id === activeChannelId"
      @click="emit('select', channel.id)"
    />
  </div>
</template>

<style scoped>
.channel-section {
  margin-bottom: var(--ph-space-2);
}

.channel-section__title {
  margin: 0;
  padding: var(--ph-space-2) var(--ph-space-2) var(--ph-space-1);
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ph-color-text-muted);
}
</style>
