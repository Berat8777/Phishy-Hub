<script lang="ts">
/**
 * See PhBoard.vue's identical comment: `<script setup>` cannot itself
 * contain ES module value exports, so this real `Symbol()` injection key
 * lives in a plain sibling `<script>` block instead.
 */
import type { ComputedRef, InjectionKey } from 'vue';

/** Provided to descendant `PhBoardCard`s so they know which column they live in. */
export const PH_BOARD_COLUMN_ID_KEY: InjectionKey<ComputedRef<string>> = Symbol('ph-board-column-id');
</script>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { PH_BOARD_CONTEXT_KEY } from '../PhBoard/PhBoard.vue';
import PhBadge from '../PhBadge/PhBadge.vue';

const props = defineProps<{
  columnId: string;
  title: string;
  /** Badge count shown next to the title, e.g. number of cards. */
  count?: number;
  /**
   * Predicate deciding whether the card currently being dragged may be
   * dropped into this column (e.g. "only the assignee or an admin").
   * Omit to allow any drop.
   */
  canDrop?: (itemId: string) => boolean;
}>();

const context = inject(PH_BOARD_CONTEXT_KEY);
if (!context) {
  throw new Error('PhBoardColumn must be used inside a PhBoard.');
}

const columnIdRef = computed(() => props.columnId);
provide(PH_BOARD_COLUMN_ID_KEY, columnIdRef);

onMounted(() => {
  context.registerColumn({ id: props.columnId, title: props.title });
});

onBeforeUnmount(() => {
  context.unregisterColumn(props.columnId);
});

watch(
  () => props.title,
  (title) => context.updateColumnTitle(props.columnId, title),
);

// Counts re-entrant dragenter/dragleave pairs so hovering over a nested
// PhBoardCard (which also fires dragenter/dragleave on this element) doesn't
// flicker the drag-over state off between the two events. Must be a ref —
// a plain closure variable establishes no reactive dependency, so a
// computed() reading it would only ever evaluate once and then be cached.
const dragDepth = ref(0);
const isDragOver = computed(() => dragDepth.value > 0);

const isRejected = computed(() => {
  const itemId = context.dragItemId.value;
  if (!itemId || !isDragOver.value || !props.canDrop) return false;
  return !props.canDrop(itemId);
});

// A cancelled drag (Escape, or drop outside any target) fires exactly one
// terminal dragleave at the currently-hovered element, not one per
// outstanding bubbled dragenter — so the counter can get stuck above zero.
// context.dragItemId reliably goes null on every drag termination path
// (PhBoardCard's dragend always fires and calls context.endDrag()), so use
// that as a hard reset.
watch(
  () => context.dragItemId.value,
  (itemId) => {
    if (!itemId) dragDepth.value = 0;
  },
);

const onDragEnter = (): void => {
  if (!context.dragItemId.value) return;
  dragDepth.value += 1;
};

const onDragOver = (event: DragEvent): void => {
  const itemId = context.dragItemId.value;
  if (!itemId) return;
  const allowed = props.canDrop ? props.canDrop(itemId) : true;
  if (allowed) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  } else if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'none';
  }
};

const onDragLeave = (): void => {
  dragDepth.value = Math.max(0, dragDepth.value - 1);
};

const onDrop = (event: DragEvent): void => {
  event.preventDefault();
  dragDepth.value = 0;
  const itemId = context.dragItemId.value;
  if (!itemId) return;
  if (props.canDrop && !props.canDrop(itemId)) return;
  context.completeDrop(props.columnId);
};
</script>

<template>
  <div
    class="ph-board-column"
    :class="{ 'ph-board-column--drag-over': isDragOver, 'ph-board-column--rejected': isRejected }"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <header class="ph-board-column__header">
      <h3 class="ph-board-column__title">{{ title }}</h3>
      <PhBadge v-if="count !== undefined">{{ count }}</PhBadge>
    </header>
    <div class="ph-board-column__body">
      <slot />
    </div>
    <div v-if="isRejected" class="ph-board-column__reject-overlay" aria-hidden="true" />
  </div>
</template>

<style scoped>
.ph-board-column {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 280px;
  max-height: 100%;
  background-color: var(--ph-color-surface-sunken);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-lg);
  transition: background-color var(--ph-duration-fast) var(--ph-easing-standard);
}

.ph-board-column--drag-over {
  outline: 2px dashed var(--ph-color-border-focus);
  outline-offset: -2px;
  background-color: var(--ph-color-accent-subtle);
}

.ph-board-column--rejected {
  outline-color: var(--ph-color-danger);
  cursor: not-allowed;
}

.ph-board-column__header {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-3) var(--ph-space-3) var(--ph-space-2);
}

.ph-board-column__title {
  flex: 1;
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.ph-board-column__body {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
  padding: 0 var(--ph-space-3) var(--ph-space-3);
  overflow-y: auto;
}

.ph-board-column__reject-overlay {
  position: absolute;
  inset: 0;
  background-color: var(--ph-color-overlay-scrim);
  opacity: 0.5;
  border-radius: var(--ph-radius-lg);
  pointer-events: none;
}
</style>
