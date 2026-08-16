<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { PhIcon, PhModal, PhSpinner, PhTooltip, useToast } from '@phishyhub/design-system';
import { useFilesStore } from '../../../../stores/files';
import { isApiError } from '../../../../api/errors';
import type { MessageAttachmentDTO } from '../../../../api/types';

/**
 * Fixed-size box (default 320x240, `object-fit: contain`) regardless of
 * loading/loaded/failed state — the file DTO carries no width/height, so
 * this is the only way to keep MessageList's scroll position from jumping
 * when an image finishes loading (task brief: "a real constraint, not a
 * nice-to-have"). `thumbWidth`/`thumbHeight` let callers outside the message
 * list (e.g. the channel-info panel's Media grid) reuse this same
 * thumbnail+zoomable-lightbox widget at a smaller grid-cell size.
 */
const props = withDefaults(
  defineProps<{ attachment: MessageAttachmentDTO; thumbWidth?: number; thumbHeight?: number }>(),
  { thumbWidth: 320, thumbHeight: 240 },
);

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

// --- Wheel zoom + drag panning (Google Photos-style: zoom anchored under the
// cursor, not center-zoom). `translate`/`scale` are applied to the image in
// the coordinate frame of `.image-lightbox` itself — see the CSS below,
// which absolutely-positions the `<img>` to fill that container (rather than
// letting it size to its own intrinsic dimensions via flexbox centering) so
// mouse coordinates measured relative to the container map 1:1 onto the
// image's own untransformed coordinate space. transform-origin is `0 0`.
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const lightboxContainer = ref<HTMLElement | null>(null);
const isPanning = ref(false);
let panPointerId: number | null = null;
let panStartClientX = 0;
let panStartClientY = 0;
let panOriginX = 0;
let panOriginY = 0;

function resetZoom(): void {
  zoom.value = 1;
  panX.value = 0;
  panY.value = 0;
}

// Reset whenever the lightbox opens/closes, or (in case this instance is
// ever reused across attachments) the underlying image changes.
watch(lightboxOpen, resetZoom);
watch(() => props.attachment.fileId, resetZoom);

function onLightboxWheel(event: WheelEvent): void {
  const container = lightboxContainer.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const cursorX = event.clientX - rect.left;
  const cursorY = event.clientY - rect.top;

  // The point in the image's own (unscaled) coordinate space currently under the cursor.
  const anchorX = (cursorX - panX.value) / zoom.value;
  const anchorY = (cursorY - panY.value) / zoom.value;

  const zoomFactor = Math.exp(-event.deltaY * 0.0015);
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value * zoomFactor));

  panX.value = cursorX - anchorX * nextZoom;
  panY.value = cursorY - anchorY * nextZoom;
  zoom.value = nextZoom;

  // Snap fully back to center once zoomed out all the way, rather than
  // leaving a stray pan offset that would show as a mis-centered image at 1x.
  if (nextZoom <= MIN_ZOOM) {
    panX.value = 0;
    panY.value = 0;
  }
}

function onLightboxPointerDown(event: PointerEvent): void {
  if (zoom.value <= MIN_ZOOM) return;
  isPanning.value = true;
  panPointerId = event.pointerId;
  panStartClientX = event.clientX;
  panStartClientY = event.clientY;
  panOriginX = panX.value;
  panOriginY = panY.value;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onLightboxPointerMove(event: PointerEvent): void {
  if (!isPanning.value || event.pointerId !== panPointerId) return;
  panX.value = panOriginX + (event.clientX - panStartClientX);
  panY.value = panOriginY + (event.clientY - panStartClientY);
}

function onLightboxPointerUp(event: PointerEvent): void {
  if (event.pointerId !== panPointerId) return;
  isPanning.value = false;
  panPointerId = null;
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
  <button
    type="button"
    class="image-preview"
    :style="{ width: `${thumbWidth}px`, height: `${thumbHeight}px` }"
    :aria-label="`Open image ${attachment.originalName}`"
    @click="openLightbox"
  >
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
    <div ref="lightboxContainer" class="image-lightbox" @wheel.prevent="onLightboxWheel">
      <PhSpinner v-if="fullLoading" size="lg" />
      <span v-else-if="fullFailed" class="image-lightbox__failed">Image unavailable</span>
      <img
        v-else
        class="image-lightbox__img"
        :class="{ 'image-lightbox__img--zoomed': zoom > 1, 'image-lightbox__img--panning': isPanning }"
        :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }"
        :src="fullUrl"
        :alt="attachment.originalName"
        draggable="false"
        @error="onFullImageError"
        @pointerdown="onLightboxPointerDown"
        @pointermove="onLightboxPointerMove"
        @pointerup="onLightboxPointerUp"
        @pointercancel="onLightboxPointerUp"
      />

      <span v-if="!fullLoading && !fullFailed && zoom > 1" class="image-lightbox__zoom-badge">{{ Math.round(zoom * 100) }}%</span>

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
  max-width: 100%;
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
  width: 100%;
  height: calc(100vh - 220px);
  min-height: 240px;
  overflow: hidden;
}

/*
 * Absolutely fills `.image-lightbox` (rather than sizing to its own
 * intrinsic dimensions via flexbox centering) so mouse coordinates measured
 * relative to the container map 1:1 onto the image's own untransformed
 * coordinate space — required for `onLightboxWheel`'s cursor-anchored zoom
 * math. `object-fit: contain` still letterboxes correctly within that box.
 */
.image-lightbox__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: var(--ph-radius-md);
  transform-origin: 0 0;
  touch-action: none;
  will-change: transform;
}

.image-lightbox__img--zoomed {
  cursor: grab;
}

.image-lightbox__img--panning {
  cursor: grabbing;
}

.image-lightbox__zoom-badge {
  position: absolute;
  bottom: var(--ph-space-3);
  left: var(--ph-space-3);
  padding: var(--ph-space-1) var(--ph-space-2);
  border-radius: var(--ph-radius-full);
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-on-accent);
  background-color: var(--ph-color-overlay-scrim);
  pointer-events: none;
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
