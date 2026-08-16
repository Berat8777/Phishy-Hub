<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { PhSpinner } from '@phishyhub/design-system';
import { useFilesStore } from '../../../../stores/files';
import type { MessageAttachmentDTO } from '../../../../api/types';

/**
 * Fixed-size box (max 320x240, `object-fit: contain`) regardless of
 * loading/loaded/failed state — the file DTO carries no width/height, so
 * this is the only way to keep MessageList's scroll position from jumping
 * when an image finishes loading (task brief: "a real constraint, not a
 * nice-to-have").
 */
const props = defineProps<{ attachment: MessageAttachmentDTO }>();

const filesStore = useFilesStore();
const thumbUrl = ref<string | undefined>(undefined);
const fullUrl = ref<string | undefined>(undefined);
const loading = ref(true);
const failed = ref(false);

async function loadThumb(): Promise<void> {
  loading.value = true;
  failed.value = false;
  try {
    // Every image upload gets a 256x256 webp thumbnail synchronously
    // (CONTRACT.md §5) — safe to always request the thumbnail variant here.
    thumbUrl.value = await filesStore.getUrl(props.attachment.fileId, 'thumbnail');
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

async function ensureFullUrl(): Promise<string | undefined> {
  if (fullUrl.value) return fullUrl.value;
  try {
    fullUrl.value = await filesStore.getUrl(props.attachment.fileId);
    return fullUrl.value;
  } catch {
    return undefined;
  }
}

/** Presigned URLs expire (~900s, CONTRACT.md §7) — refetch on a broken load instead of leaving a dead image. */
async function onImageError(): Promise<void> {
  try {
    thumbUrl.value = await filesStore.refreshUrl(props.attachment.fileId, 'thumbnail');
    failed.value = false;
  } catch {
    failed.value = true;
  }
}

async function openFull(): Promise<void> {
  const url = await ensureFullUrl();
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

onMounted(loadThumb);
</script>

<template>
  <button type="button" class="image-preview" :aria-label="`Open image ${attachment.originalName}`" @click="openFull">
    <PhSpinner v-if="loading" size="sm" />
    <span v-else-if="failed" class="image-preview__failed">Image unavailable</span>
    <img
      v-else
      class="image-preview__img"
      :src="thumbUrl"
      :alt="attachment.originalName"
      loading="lazy"
      @error="onImageError"
    />
  </button>
</template>

<style scoped>
.image-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 320px;
  max-width: 100%;
  height: 240px;
  overflow: hidden;
  background-color: var(--ph-color-surface-sunken);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-md);
  cursor: zoom-in;
}

.image-preview__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.image-preview__failed {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}
</style>
