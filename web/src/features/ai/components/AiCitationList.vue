<script setup lang="ts">
import { ref } from 'vue';
import { PhIcon, PhModal } from '@phishyhub/design-system';
import type { AiCitation, AiSearchHit } from '../../../api/types';

/** Shared between "Ask" citations (AiCitation) and "Search" hits (AiSearchHit) — same rendering, AiCitation just has a couple of extra fields this component doesn't need. */
defineProps<{ citations: (AiCitation | AiSearchHit)[]; emptyLabel?: string }>();

const openCitation = ref<AiCitation | AiSearchHit | null>(null);

function openModal(citation: AiCitation | AiSearchHit): void {
  openCitation.value = citation;
}
</script>

<template>
  <div class="ai-citation-list">
    <p v-if="citations.length === 0 && emptyLabel" class="ai-citation-list__empty">{{ emptyLabel }}</p>
    <button
      v-for="(citation, index) in citations"
      :key="`${citation.path}-${citation.startLine}-${index}`"
      type="button"
      class="ai-citation-list__item"
      @click="openModal(citation)"
    >
      <PhIcon name="FileCode2" size="sm" class="ai-citation-list__icon" />
      <span class="ai-citation-list__meta">
        <span class="ai-citation-list__path">{{ citation.path }}:{{ citation.startLine }}-{{ citation.endLine }}</span>
        <span v-if="citation.heading" class="ai-citation-list__heading">{{ citation.heading }}</span>
      </span>
    </button>

    <PhModal
      :model-value="openCitation !== null"
      :title="openCitation ? `${openCitation.path}:${openCitation.startLine}-${openCitation.endLine}` : undefined"
      size="lg"
      @update:model-value="(v) => { if (!v) openCitation = null; }"
    >
      <pre v-if="openCitation" class="ai-citation-list__code"><code>{{ openCitation.content }}</code></pre>
    </PhModal>
  </div>
</template>

<style scoped>
.ai-citation-list {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
}

.ai-citation-list__empty {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.ai-citation-list__item {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-2) var(--ph-space-3);
  text-align: left;
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-md);
  background-color: var(--ph-color-surface-raised);
  transition: background-color var(--ph-duration-fast) var(--ph-easing-standard);
}

.ai-citation-list__item:hover {
  background-color: var(--ph-color-surface-hover);
}

.ai-citation-list__icon {
  flex: 0 0 auto;
  color: var(--ph-color-text-subtle);
}

.ai-citation-list__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ai-citation-list__path {
  font-family: var(--ph-font-family-mono, monospace);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-accent);
  overflow-wrap: anywhere;
}

.ai-citation-list__heading {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-muted);
}

.ai-citation-list__code {
  margin: 0;
  padding: var(--ph-space-3);
  overflow: auto;
  background-color: var(--ph-color-surface-sunken);
  border-radius: var(--ph-radius-md);
  font-family: var(--ph-font-family-mono, monospace);
  font-size: var(--ph-font-size-sm);
  white-space: pre;
}
</style>
