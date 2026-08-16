<script setup lang="ts">
import { PhIcon, PhSpinner } from '@phishyhub/design-system';

export interface PendingAttachment {
  id: string;
  file: File;
  status: 'uploading' | 'done' | 'error';
  /** 0..1 */
  progress: number;
  fileId?: string;
  errorMessage?: string;
}

defineProps<{ attachments: PendingAttachment[] }>();
const emit = defineEmits<{ remove: [id: string] }>();

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <div v-if="attachments.length" class="attachment-tray">
    <div v-for="item in attachments" :key="item.id" class="attachment-tray__item">
      <PhIcon name="Paperclip" size="sm" class="attachment-tray__icon" />
      <div class="attachment-tray__body">
        <div class="attachment-tray__row">
          <span class="attachment-tray__name">{{ item.file.name }}</span>
          <span class="attachment-tray__meta">{{ formatSize(item.file.size) }}</span>
        </div>
        <div v-if="item.status === 'uploading'" class="attachment-tray__progress">
          <div class="attachment-tray__progress-fill" :style="{ width: `${Math.round(item.progress * 100)}%` }" />
        </div>
        <span v-else-if="item.status === 'error'" class="attachment-tray__error">{{ item.errorMessage ?? 'Upload failed' }}</span>
      </div>
      <PhSpinner v-if="item.status === 'uploading'" size="sm" />
      <PhIcon v-else-if="item.status === 'error'" name="AlertCircle" size="sm" color="var(--ph-color-danger)" />
      <PhIcon v-else name="Check" size="sm" color="var(--ph-color-success)" />
      <button type="button" class="attachment-tray__remove" aria-label="Remove attachment" @click="emit('remove', item.id)">
        <PhIcon name="X" size="xs" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.attachment-tray {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  padding: var(--ph-space-2) var(--ph-space-4);
}

.attachment-tray__item {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-1) var(--ph-space-2);
  background-color: var(--ph-color-surface-sunken);
  border-radius: var(--ph-radius-md);
}

.attachment-tray__icon {
  color: var(--ph-color-text-muted);
  flex-shrink: 0;
}

.attachment-tray__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.attachment-tray__row {
  display: flex;
  align-items: baseline;
  gap: var(--ph-space-2);
}

.attachment-tray__name {
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-tray__meta {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
  flex-shrink: 0;
}

.attachment-tray__progress {
  height: 3px;
  background-color: var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-full);
  overflow: hidden;
}

.attachment-tray__progress-fill {
  height: 100%;
  background-color: var(--ph-color-accent);
  transition: width var(--ph-duration-fast) var(--ph-easing-standard);
}

.attachment-tray__error {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-danger);
}

.attachment-tray__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: var(--ph-radius-sm);
  color: var(--ph-color-text-muted);
}

.attachment-tray__remove:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}
</style>
