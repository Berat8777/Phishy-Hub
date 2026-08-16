<script setup lang="ts">
import { ref, watch } from 'vue';
import { PhButton, PhEmptyState, PhIcon, PhModal, PhSpinner, useToast } from '@phishyhub/design-system';
import * as channelsApi from '../../../../api/endpoints/channels';
import { useChannelsStore } from '../../../../stores/channels';
import { isApiError } from '../../../../api/errors';
import type { ChannelListItemDTO } from '../../../../api/types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; joined: [channelId: string] }>();

const channelsStore = useChannelsStore();
const toast = useToast();

const loading = ref(false);
const channels = ref<ChannelListItemDTO[]>([]);
const joiningId = ref<string | null>(null);

/**
 * CONTRACT.md §3.5: `GET /channels` (even with `?type=public`) only ever
 * returns channels the caller is ALREADY a member of — there is no backend
 * endpoint to discover public channels the caller hasn't joined. This still
 * calls the closest real endpoint (offset-paginated, per the task brief)
 * and filters out already-joined channels client-side, but given the above
 * that filter will typically leave the list empty against the current API.
 * Documented as a contract gap in the implementation handoff, not silently
 * worked around — the UI (list + join button) is built to spec and will
 * work the moment a real "discover" endpoint exists.
 */
async function load(): Promise<void> {
  loading.value = true;
  try {
    const { items } = await channelsApi.listChannels({ type: 'public', pageSize: 100 });
    channels.value = items.filter((c) => !channelsStore.byId.has(c.id));
  } catch (err) {
    toast.push({
      title: 'Could not load channels',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void load();
  },
);

async function onJoin(channelId: string): Promise<void> {
  joiningId.value = channelId;
  try {
    await channelsApi.joinChannel(channelId);
    channels.value = channels.value.filter((c) => c.id !== channelId);
    emit('joined', channelId);
  } catch (err) {
    toast.push({
      title: 'Could not join channel',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    joiningId.value = null;
  }
}
</script>

<template>
  <PhModal :model-value="modelValue" title="Browse channels" @update:model-value="emit('update:modelValue', $event)">
    <PhSpinner v-if="loading" />
    <PhEmptyState
      v-else-if="channels.length === 0"
      title="No channels to join"
      description="You're already a member of every public channel visible to you."
    >
      <template #icon><PhIcon name="Hash" size="xl" /></template>
    </PhEmptyState>
    <ul v-else class="channel-browser__list">
      <li v-for="channel in channels" :key="channel.id" class="channel-browser__item">
        <span class="channel-browser__name"><PhIcon name="Hash" size="sm" /> {{ channel.name }}</span>
        <PhButton size="sm" :loading="joiningId === channel.id" @click="onJoin(channel.id)">Join</PhButton>
      </li>
    </ul>
  </PhModal>
</template>

<style scoped>
.channel-browser__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
}

.channel-browser__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-3);
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-md);
}

.channel-browser__item:hover {
  background-color: var(--ph-color-surface-hover);
}

.channel-browser__name {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-2);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
}
</style>
