<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { PhEmptyState, PhIcon, PhInput, PhModal, PhSpinner } from '@phishyhub/design-system';
import { useSearchStore } from '../../../../stores/search';
import { useChannelsStore } from '../../../../stores/channels';
import SearchResultItem from './SearchResultItem.vue';
import type { MessageDTO } from '../../../../api/types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const searchStore = useSearchStore();
const channelsStore = useChannelsStore();
const router = useRouter();
const draft = ref('');
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      draft.value = '';
      searchStore.reset();
    }
  },
);

watch(draft, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void searchStore.search(value), 250);
});

function channelLabel(channelId: string): string | undefined {
  const channel = channelsStore.getChannel(channelId);
  return channel?.name ?? undefined;
}

/** Hands the target off via the search store (SearchPanel has no reference to MessageList — ChatView owns that and watches `scrollTarget`) then navigates there and closes. */
function onResultClick(message: MessageDTO): void {
  searchStore.requestScrollTo(message.channelId, message.id);
  void router.push({ name: 'chat', params: { channelId: message.channelId } });
  emit('update:modelValue', false);
}
</script>

<template>
  <PhModal :model-value="modelValue" title="Search messages" size="lg" @update:model-value="emit('update:modelValue', $event)">
    <div class="search-panel">
      <PhInput v-model="draft" type="search" placeholder="Search messages…" autofocus />

      <PhSpinner v-if="searchStore.loading" class="search-panel__loading" />

      <PhEmptyState
        v-else-if="draft && searchStore.results.length === 0"
        title="No results"
        description="Try a different search term."
      >
        <template #icon><PhIcon name="Search" size="xl" /></template>
      </PhEmptyState>

      <ul v-else-if="searchStore.results.length" class="search-panel__results">
        <li v-for="message in searchStore.results" :key="message.id">
          <SearchResultItem
            :message="message"
            :channel-label="channelLabel(message.channelId)"
            @click="onResultClick(message)"
          />
        </li>
      </ul>
    </div>
  </PhModal>
</template>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-3);
  min-height: 200px;
}

.search-panel__loading {
  align-self: center;
  margin-top: var(--ph-space-5);
}

.search-panel__results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 420px;
  overflow-y: auto;
}
</style>
