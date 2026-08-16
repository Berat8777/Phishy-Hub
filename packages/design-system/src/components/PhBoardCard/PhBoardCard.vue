<script setup lang="ts">
/**
 * Draggable card wrapper for use inside a `PhBoardColumn`. Native HTML5
 * drag-and-drop doesn't work on touch devices and needs a keyboard fallback
 * regardless, so every card also renders a "Move to…" `<select>` — visually
 * hidden until it receives focus (same technique as a skip-link), so mouse
 * users doing drag-and-drop see no extra chrome, but keyboard/touch users
 * get full parity: choosing an option fires the same move-intent as a drop.
 */
import { computed, inject } from 'vue';
import { PH_BOARD_CONTEXT_KEY } from '../PhBoard/PhBoard.vue';
import { PH_BOARD_COLUMN_ID_KEY } from '../PhBoardColumn/PhBoardColumn.vue';

const props = withDefaults(
  defineProps<{
    itemId: string;
    /** Set false to disable dragging for this card (e.g. a permission check). */
    draggable?: boolean;
  }>(),
  {
    draggable: true,
  },
);

const emit = defineEmits<{
  dragstart: [];
  dragend: [];
}>();

const context = inject(PH_BOARD_CONTEXT_KEY);
if (!context) {
  throw new Error('PhBoardCard must be used inside a PhBoard.');
}

const columnIdRef = inject(PH_BOARD_COLUMN_ID_KEY);
if (!columnIdRef) {
  throw new Error('PhBoardCard must be used inside a PhBoardColumn.');
}

const isBeingDragged = computed(() => context.dragItemId.value === props.itemId);

const moveTargets = computed(() => context.columns.filter((column) => column.id !== columnIdRef.value));

const onDragStart = (event: DragEvent): void => {
  if (!props.draggable) return;
  context.startDrag(props.itemId, columnIdRef.value);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', props.itemId);
  }
  emit('dragstart');
};

const onDragEnd = (): void => {
  context.endDrag();
  emit('dragend');
};

const onMoveSelect = (event: Event): void => {
  const select = event.target as HTMLSelectElement;
  const toColumnId = select.value;
  select.value = '';
  if (!toColumnId) return;
  context.moveItem(props.itemId, columnIdRef.value, toColumnId);
};
</script>

<template>
  <div
    class="ph-board-card"
    :class="{ 'ph-board-card--dragging': isBeingDragged }"
    :draggable="draggable"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div class="ph-board-card__content">
      <slot />
    </div>
    <div v-if="moveTargets.length > 0" class="ph-board-card__move">
      <label class="ph-visually-hidden" :for="`ph-board-card-move-${itemId}`">Move card to another column</label>
      <select :id="`ph-board-card-move-${itemId}`" class="ph-board-card__move-select" @change="onMoveSelect">
        <option value="">Move to…</option>
        <option v-for="column in moveTargets" :key="column.id" :value="column.id">
          {{ column.title }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.ph-board-card {
  position: relative;
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-md);
  box-shadow: var(--ph-shadow-sm);
  cursor: grab;
  transition: opacity var(--ph-duration-fast) var(--ph-easing-standard);
}

.ph-board-card--dragging {
  opacity: 0.5;
}

.ph-board-card__content {
  padding: var(--ph-space-3);
}

.ph-board-card__move {
  position: absolute;
  top: var(--ph-space-1);
  right: var(--ph-space-1);
}

.ph-board-card__move-select {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.ph-board-card__move-select:focus-visible {
  position: static;
  width: auto;
  height: auto;
  margin: 0;
  padding: var(--ph-space-1) var(--ph-space-2);
  overflow: visible;
  clip: auto;
  white-space: normal;
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-sm);
  color: var(--ph-color-text-default);
  font-size: var(--ph-font-size-xs);
  outline: none;
  box-shadow: var(--ph-focus-ring);
}
</style>
