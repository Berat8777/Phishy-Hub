<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { PhIcon } from '@phishyhub/design-system';
import { useFilesStore } from '../../../../stores/files';
import type { MessageAttachmentDTO } from '../../../../api/types';

const props = defineProps<{ attachment: MessageAttachmentDTO }>();

const filesStore = useFilesStore();
const href = ref<string | undefined>(undefined);
const failed = ref(false);

async function load(): Promise<void> {
  try {
    href.value = await filesStore.getUrl(props.attachment.fileId);
    failed.value = false;
  } catch {
    failed.value = true;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

onMounted(load);
</script>

<template>
  <a
    class="file-card"
    :class="{ 'file-card--disabled': !href }"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    @click="!href && $event.preventDefault()"
  >
    <span class="file-card__icon"><PhIcon name="File" size="md" /></span>
    <span class="file-card__body">
      <span class="file-card__name">{{ attachment.originalName }}</span>
      <span class="file-card__meta">{{ formatSize(attachment.sizeBytes) }}</span>
    </span>
    <button v-if="failed" type="button" class="file-card__retry" @click.prevent="load">Retry</button>
  </a>
</template>

<style scoped>
.file-card {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-2);
  max-width: 280px;
  padding: var(--ph-space-2) var(--ph-space-3);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-md);
  background-color: var(--ph-color-surface-raised);
  text-decoration: none;
  color: inherit;
}

.file-card:hover {
  border-color: var(--ph-color-border-focus);
}

.file-card--disabled {
  cursor: default;
  opacity: 0.7;
}

.file-card__icon {
  display: inline-flex;
  color: var(--ph-color-text-muted);
}

.file-card__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.file-card__name {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card__meta {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}

.file-card__retry {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-accent);
  text-decoration: underline;
}
</style>
