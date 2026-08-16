<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { PhIcon, PhModal, PhSpinner, PhTooltip, useToast } from '@phishyhub/design-system';
import { useFilesStore } from '../../../../stores/files';
import { isApiError } from '../../../../api/errors';
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
const toast = useToast();
const thumbUrl = ref<string | undefined>(undefined);
const fullUrl = ref<string | undefined>(undefined);
const loading = ref(true);
const failed = ref(false);

const lightboxOpen = ref(false);
const fullLoading = ref(false);
const fullFailed = ref(false);
const downloading = ref(false);

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

/** Presigned URLs expire (~900s, CONTRACT.md §7) — refetch on a broken load instead of leaving a dead image. */
async function onImageError(): Promise<void> {
  try {
    thumbUrl.value = await filesStore.refreshUrl(props.attachment.fileId, 'thumbnail');
    failed.value = false;
  } catch {
    failed.value = true;
  }
}

/**
 * The full-size (non-thumbnail) presigned URL — same cache-with-expiresAt
 * pattern as the thumbnail above, reused via `filesStore` rather than a new
 * fetch path. Loaded lazily on first lightbox open, not on mount, since most
 * images in a scrolled-past message list are never opened full-size.
 */
async function loadFull(): Promise<void> {
  fullLoading.value = true;
  fullFailed.value = false;
  try {
    fullUrl.value = await filesStore.getUrl(props.attachment.fileId);
  } catch {
    fullFailed.value = true;
  } finally {
    fullLoading.value = false;
  }
}

async function onFullImageError(): Promise<void> {
  try {
    fullUrl.value = await filesStore.refreshUrl(props.attachment.fileId);
    fullFailed.value = false;
  } catch {
    fullFailed.value = true;
  }
}

function openLightbox(): void {
  lightboxOpen.value = true;
  if (!fullUrl.value) void loadFull();
}

/**
 * Explicit "save this file" affordance, separate from the image click
 * itself (task brief — clicking the image must open a preview, not
 * download). The presigned URL the server hands back for the non-thumbnail
 * variant always carries `Content-Disposition: attachment`
 * (storage.service.ts's `getPresignedDownloadUrl` call always passes
 * `file.originalName` for the full variant) — navigating an `<a download>`
 * to it triggers a real save-as, it just can't be used as the `<img>` src
 * for the lightbox itself without forcing a download on load, which is why
 * the lightbox's own `<img>` reuses the same cached URL and this button
 * separately drives an anchor click against it.
 */
async function downloadFull(): Promise<void> {
  downloading.value = true;
  try {
    const url = fullUrl.value ?? (await filesStore.getUrl(props.attachment.fileId));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = props.attachment.originalName;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch (err) {
    toast.push({
      title: 'Download failed',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    downloading.value = false;
  }
}

onMounted(loadThumb);
</script>

<template>
  <button type="button" class="image-preview" :aria-label="`Open image ${attachment.originalName}`" @click="openLightbox">
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

  <PhModal v-model="lightboxOpen" size="lg" :title="attachment.originalName">
    <div class="image-lightbox">
      <PhSpinner v-if="fullLoading" size="lg" />
      <span v-else-if="fullFailed" class="image-lightbox__failed">Image unavailable</span>
      <img
        v-else
        class="image-lightbox__img"
        :src="fullUrl"
        :alt="attachment.originalName"
        @error="onFullImageError"
      />

      <PhTooltip text="Download">
        <button
          type="button"
          class="image-lightbox__download"
          aria-label="Download image"
          :disabled="downloading"
          @click="downloadFull"
        >
          <PhSpinner v-if="downloading" size="sm" />
          <PhIcon v-else name="Download" size="sm" />
        </button>
      </PhTooltip>
    </div>
  </PhModal>
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

.image-lightbox {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}

.image-lightbox__img {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 220px);
  object-fit: contain;
  border-radius: var(--ph-radius-md);
}

.image-lightbox__failed {
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-subtle);
}

.image-lightbox__download {
  position: absolute;
  top: var(--ph-space-3);
  right: var(--ph-space-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--ph-radius-full);
  background-color: var(--ph-color-overlay-scrim);
  color: var(--ph-color-text-on-accent);
  box-shadow: var(--ph-shadow-md);
}

.image-lightbox__download:hover {
  background-color: var(--ph-color-overlay-scrim);
  opacity: 0.85;
}

.image-lightbox__download:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.image-lightbox__download:disabled {
  cursor: default;
  opacity: 0.7;
}
</style>
