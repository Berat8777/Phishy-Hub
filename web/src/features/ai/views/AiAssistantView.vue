<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { PhBadge, PhButton, PhEmptyState, PhIcon, PhInput, PhScrollArea, PhSpinner, PhTabs, PhTextarea, useToast } from '@phishyhub/design-system';
import type { TabItem } from '@phishyhub/design-system';
import { useAiStore } from '../../../stores/ai';
import { isApiError } from '../../../api/errors';
import AiCitationList from '../components/AiCitationList.vue';
import type { AiSearchHit } from '../../../api/types';

/**
 * Phase 6 / Module 7 — AI RAG code assistant. Two modes (PhTabs, matching
 * the existing tabbed-panel pattern): "Ask" (streamed Q&A, `POST
 * /ai/query`) and "Search" (pure retrieval, `POST /ai/search`, no
 * streaming/socket involved). Recent history (`GET /ai/queries`) is folded
 * into the Ask panel rather than a separate route/component — kept simple
 * per the task brief.
 */

const aiStore = useAiStore();
const toast = useToast();

const activeTab = ref<'ask' | 'search'>('ask');
const tabs: TabItem[] = [
  { id: 'ask', label: 'Ask' },
  { id: 'search', label: 'Search' },
];

const question = ref('');
const asking = ref(false);
const activeQueryId = ref<string | null>(null);

const searchQuery = ref('');
const searching = ref(false);
const searchResults = ref<AiSearchHit[]>([]);
const searchRan = ref(false);

const activeAnswer = computed(() => (activeQueryId.value ? (aiStore.streamingByQueryId[activeQueryId.value] ?? '') : ''));
const activeCitations = computed(() => (activeQueryId.value ? (aiStore.citationsByQueryId[activeQueryId.value] ?? []) : []));
const activeError = computed(() => (activeQueryId.value ? aiStore.errorByQueryId[activeQueryId.value] : undefined));
const isActiveStreaming = computed(() => (activeQueryId.value ? Boolean(aiStore.activeQueryIds[activeQueryId.value]) : false));

onMounted(async () => {
  try {
    await aiStore.fetchStatus();
  } catch {
    // Status is best-effort — the Ask/Search actions below still surface a
    // clear error (AI_UNAVAILABLE etc.) if the feature turns out to be down.
  }
  void aiStore.fetchHistory();
});

function describeError(err: unknown): string {
  return isApiError(err) ? err.message : 'Something went wrong.';
}

async function onAsk(): Promise<void> {
  const trimmed = question.value.trim();
  if (!trimmed) return;
  asking.value = true;
  try {
    const res = await aiStore.ask(trimmed);
    activeQueryId.value = res.queryId;
    question.value = '';
    void aiStore.fetchHistory();
  } catch (err) {
    toast.push({ title: 'Could not ask the AI assistant', description: describeError(err), variant: 'danger' });
  } finally {
    asking.value = false;
  }
}

async function onSelectHistory(queryId: string): Promise<void> {
  try {
    const q = await aiStore.fetchQuery(queryId);
    activeQueryId.value = q.id;
    activeTab.value = 'ask';
  } catch (err) {
    toast.push({ title: 'Could not load that question', description: describeError(err), variant: 'danger' });
  }
}

async function onSearch(): Promise<void> {
  const trimmed = searchQuery.value.trim();
  if (!trimmed) return;
  searching.value = true;
  try {
    searchResults.value = await aiStore.search(trimmed);
    searchRan.value = true;
  } catch (err) {
    toast.push({ title: 'Search failed', description: describeError(err), variant: 'danger' });
  } finally {
    searching.value = false;
  }
}
</script>

<template>
  <div class="ai-assistant-view">
    <header class="ai-assistant-view__header">
      <h1 class="ai-assistant-view__title">
        <PhIcon name="Sparkles" size="md" />
        AI Assistant
      </h1>
      <PhBadge v-if="aiStore.status" :variant="aiStore.status.enabled ? 'success' : 'default'">
        {{ aiStore.status.enabled ? (aiStore.status.model ?? aiStore.status.provider ?? 'Enabled') : 'Unavailable' }}
      </PhBadge>
    </header>

    <PhEmptyState
      v-if="aiStore.status && !aiStore.status.enabled"
      title="AI assistant is currently unavailable"
      description="The service isn't configured or reachable right now — try again later."
    >
      <template #icon><PhIcon name="AlertTriangle" size="lg" /></template>
    </PhEmptyState>

    <PhTabs v-else v-model="activeTab" :tabs="tabs">
      <template #ask>
        <div class="ai-assistant-view__ask">
          <PhTextarea
            v-model="question"
            placeholder="Ask a question about this codebase…"
            :rows="3"
            auto-grow
            :disabled="asking"
            @keydown.enter.exact.prevent="onAsk"
          />
          <div class="ai-assistant-view__ask-actions">
            <PhButton size="sm" :loading="asking" :disabled="!question.trim()" @click="onAsk">
              <PhIcon name="Send" size="sm" /> Ask
            </PhButton>
          </div>

          <div v-if="activeQueryId" class="ai-assistant-view__answer">
            <p v-if="activeError" class="ai-assistant-view__error">
              <PhIcon name="AlertCircle" size="sm" /> {{ activeError.message }}
            </p>
            <template v-else>
              <p class="ai-assistant-view__answer-text">{{ activeAnswer }}<span v-if="isActiveStreaming" class="ai-assistant-view__caret" aria-hidden="true" /></p>
              <PhSpinner v-if="isActiveStreaming && !activeAnswer" size="sm" />
            </template>
            <AiCitationList v-if="activeCitations.length" :citations="activeCitations" />
          </div>

          <div class="ai-assistant-view__history">
            <h2 class="ai-assistant-view__section-title">Recent questions</h2>
            <PhSpinner v-if="aiStore.historyLoading" size="sm" />
            <PhEmptyState v-else-if="aiStore.history.length === 0" title="No questions yet" description="Ask something above to get started." />
            <PhScrollArea v-else max-height="320px">
              <ul class="ai-assistant-view__history-list">
                <li v-for="item in aiStore.history" :key="item.id">
                  <button type="button" class="ai-assistant-view__history-item" @click="onSelectHistory(item.id)">
                    <span class="ai-assistant-view__history-question">{{ item.question }}</span>
                    <PhBadge v-if="item.status !== 'succeeded'" variant="default">{{ item.status }}</PhBadge>
                  </button>
                </li>
              </ul>
            </PhScrollArea>
          </div>
        </div>
      </template>

      <template #search>
        <div class="ai-assistant-view__search">
          <div class="ai-assistant-view__search-bar">
            <PhInput v-model="searchQuery" type="search" placeholder="Search the indexed codebase…" @keydown.enter="onSearch" />
            <PhButton size="sm" :loading="searching" :disabled="!searchQuery.trim()" @click="onSearch">
              <PhIcon name="Search" size="sm" /> Search
            </PhButton>
          </div>
          <PhEmptyState
            v-if="searchRan && !searching && searchResults.length === 0"
            title="No matches"
            description="Try a different query."
          />
          <AiCitationList v-else :citations="searchResults" />
        </div>
      </template>
    </PhTabs>
  </div>
</template>

<style scoped>
.ai-assistant-view {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
  max-width: 760px;
  padding: var(--ph-space-5);
  overflow-y: auto;
}

.ai-assistant-view__header {
  display: flex;
  align-items: center;
  gap: var(--ph-space-3);
}

.ai-assistant-view__title {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  margin: 0;
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.ai-assistant-view__ask,
.ai-assistant-view__search {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-3);
}

.ai-assistant-view__ask-actions {
  display: flex;
  justify-content: flex-end;
}

.ai-assistant-view__answer {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-3);
  padding: var(--ph-space-4);
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-lg);
}

.ai-assistant-view__answer-text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--ph-color-text-default);
}

.ai-assistant-view__caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background-color: var(--ph-color-accent);
  animation: ph-ai-caret-blink 1s step-end infinite;
}

@keyframes ph-ai-caret-blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

.ai-assistant-view__error {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  margin: 0;
  color: var(--ph-color-danger);
}

.ai-assistant-view__section-title {
  margin: 0 0 var(--ph-space-2);
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-muted);
}

.ai-assistant-view__history-list {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.ai-assistant-view__history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-2);
  width: 100%;
  padding: var(--ph-space-2) var(--ph-space-3);
  text-align: left;
  border-radius: var(--ph-radius-md);
}

.ai-assistant-view__history-item:hover {
  background-color: var(--ph-color-surface-hover);
}

.ai-assistant-view__history-question {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
}

.ai-assistant-view__search-bar {
  display: flex;
  gap: var(--ph-space-2);
}

.ai-assistant-view__search-bar :deep(.ph-input) {
  flex: 1 1 auto;
}
</style>
