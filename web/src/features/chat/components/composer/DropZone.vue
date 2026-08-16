<script setup lang="ts">
import { ref } from 'vue';

/**
 * Generic drag-drop wrapper — `display: contents` so it never interferes
 * with the flex layout of whatever it wraps (AppShell.vue uses this around
 * BOTH the sidebar and main named router-views, per the task brief: "drag-
 * and-drop anywhere in the chat area should work", not just over the
 * composer's own textarea).
 */
const emit = defineEmits<{ dropFiles: [files: File[]] }>();

const isDragging = ref(false);
let dragDepth = 0;

function hasFiles(event: DragEvent): boolean {
  return Boolean(event.dataTransfer?.types.includes('Files'));
}

function onDragEnter(event: DragEvent): void {
  if (!hasFiles(event)) return;
  dragDepth += 1;
  isDragging.value = true;
}

function onDragOver(event: DragEvent): void {
  if (!hasFiles(event)) return;
  event.preventDefault();
}

function onDragLeave(): void {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) isDragging.value = false;
}

function onDrop(event: DragEvent): void {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth = 0;
  isDragging.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (files.length) emit('dropFiles', files);
}
</script>

<template>
  <div class="drop-zone" @dragenter="onDragEnter" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
    <slot />
    <div v-if="isDragging" class="drop-zone__overlay" aria-hidden="true">
      <p>Drop files to attach</p>
    </div>
  </div>
</template>

<style scoped>
.drop-zone {
  display: contents;
}

.drop-zone__overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--ph-color-overlay-scrim);
  pointer-events: none;
}

.drop-zone__overlay p {
  padding: var(--ph-space-4) var(--ph-space-6);
  background-color: var(--ph-color-surface-overlay);
  color: var(--ph-color-text-default);
  border-radius: var(--ph-radius-lg);
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  box-shadow: var(--ph-shadow-lg);
}
</style>
