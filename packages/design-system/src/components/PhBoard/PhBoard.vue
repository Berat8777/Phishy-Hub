<script lang="ts">
/**
 * Types/injection-key live in a plain (non-`setup`) `<script>` block because
 * `<script setup>` cannot itself contain ES module value exports (only
 * type-only exports, which are erased at compile time) — `PH_BOARD_CONTEXT_KEY`
 * is a real runtime `Symbol()`, so it has to live here. Vue merges both
 * script blocks into the same module scope, so `<script setup>` below still
 * sees these declarations directly, no import needed.
 */
import type { InjectionKey, Ref } from 'vue';

export interface PhBoardColumnMeta {
  id: string;
  title: string;
}

export interface PhBoardMovePayload {
  itemId: string;
  fromColumnId: string;
  toColumnId: string;
}

export interface PhBoardContext {
  /** Columns currently mounted under this board, in mount order. */
  columns: PhBoardColumnMeta[];
  /** Id of the card currently being dragged, if any. */
  dragItemId: Ref<string | null>;
  registerColumn: (meta: PhBoardColumnMeta) => void;
  unregisterColumn: (id: string) => void;
  updateColumnTitle: (id: string, title: string) => void;
  startDrag: (itemId: string, fromColumnId: string) => void;
  endDrag: () => void;
  completeDrop: (toColumnId: string) => void;
  /** Keyboard-fallback move (no native drag session involved). */
  moveItem: (itemId: string, fromColumnId: string, toColumnId: string) => void;
}

export const PH_BOARD_CONTEXT_KEY: InjectionKey<PhBoardContext> = Symbol('ph-board-context');
</script>

<script setup lang="ts">
/**
 * Top-level drag-and-drop board. Lays out `PhBoardColumn`s (rendered by the
 * consumer via the default slot) in a horizontal, scrollable row.
 *
 * `PhBoard` never mutates data — it only ever emits `item-move`, an intent.
 * The consumer (a store) owns the real state, the optimistic update, the
 * server call, and rollback-on-failure.
 *
 * Drag/drop coordination between `PhBoard`, `PhBoardColumn`, and
 * `PhBoardCard` happens via provide/inject (see `PH_BOARD_CONTEXT_KEY`)
 * rather than `dataTransfer.getData()`, since most browsers don't expose
 * drag payload values during `dragover` (only during `drop`), and columns
 * need the dragged item's id *during* `dragover` to evaluate `canDrop`.
 */
import { provide, reactive, ref } from 'vue';

const emit = defineEmits<{
  'item-move': [payload: PhBoardMovePayload];
}>();

const columns = reactive<PhBoardColumnMeta[]>([]);
const dragItemId = ref<string | null>(null);
const dragFromColumnId = ref<string | null>(null);

function registerColumn(meta: PhBoardColumnMeta): void {
  columns.push(meta);
}

function unregisterColumn(id: string): void {
  const index = columns.findIndex((column) => column.id === id);
  if (index !== -1) columns.splice(index, 1);
}

function updateColumnTitle(id: string, title: string): void {
  const column = columns.find((c) => c.id === id);
  if (column) column.title = title;
}

function startDrag(itemId: string, fromColumnId: string): void {
  dragItemId.value = itemId;
  dragFromColumnId.value = fromColumnId;
}

function endDrag(): void {
  dragItemId.value = null;
  dragFromColumnId.value = null;
}

function completeDrop(toColumnId: string): void {
  if (!dragItemId.value || !dragFromColumnId.value) return;
  if (dragFromColumnId.value !== toColumnId) {
    emit('item-move', {
      itemId: dragItemId.value,
      fromColumnId: dragFromColumnId.value,
      toColumnId,
    });
  }
  endDrag();
}

function moveItem(itemId: string, fromColumnId: string, toColumnId: string): void {
  if (fromColumnId === toColumnId) return;
  emit('item-move', { itemId, fromColumnId, toColumnId });
}

provide(PH_BOARD_CONTEXT_KEY, {
  columns,
  dragItemId,
  registerColumn,
  unregisterColumn,
  updateColumnTitle,
  startDrag,
  endDrag,
  completeDrop,
  moveItem,
});
</script>

<template>
  <div class="ph-board">
    <slot />
  </div>
</template>

<style scoped>
.ph-board {
  display: flex;
  align-items: flex-start;
  gap: var(--ph-space-4);
  width: 100%;
  overflow-x: auto;
  padding-bottom: var(--ph-space-2);
}
</style>
