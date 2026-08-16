<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * Generic data table. `PhTable` never sorts `rows` itself — clicking a
 * sortable header only tracks/toggles the current sort indicator and emits
 * `sort`; the consumer owns re-sorting the data it passes back in.
 */
import { ref } from 'vue';
import PhSkeleton from '../PhSkeleton/PhSkeleton.vue';
import PhEmptyState from '../PhEmptyState/PhEmptyState.vue';
import PhIcon from '../PhIcon/PhIcon.vue';

export interface PhTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

export type PhTableSortDirection = 'asc' | 'desc';

export interface PhTableSortPayload {
  key: string;
  direction: PhTableSortDirection;
}

const props = withDefaults(
  defineProps<{
    columns: PhTableColumn[];
    rows: T[];
    loading?: boolean;
    /** Derives a stable `:key` per row; defaults to the row's index. */
    rowKey?: (row: T, index: number) => string | number;
    emptyTitle?: string;
    emptyDescription?: string;
    /** Number of skeleton rows rendered while `loading` is true. */
    skeletonRows?: number;
  }>(),
  {
    loading: false,
    rowKey: undefined,
    emptyTitle: 'No data',
    emptyDescription: undefined,
    skeletonRows: 4,
  },
);

const emit = defineEmits<{
  sort: [payload: PhTableSortPayload];
}>();

const sortKey = ref<string | null>(null);
const sortDirection = ref<PhTableSortDirection>('asc');

function toggleSort(column: PhTableColumn): void {
  if (!column.sortable) return;
  if (sortKey.value === column.key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = column.key;
    sortDirection.value = 'asc';
  }
  emit('sort', { key: sortKey.value, direction: sortDirection.value });
}

function keyFor(row: T, index: number): string | number {
  return props.rowKey ? props.rowKey(row, index) : index;
}
</script>

<template>
  <div class="ph-table-wrapper">
    <table class="ph-table">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            class="ph-table__header"
            :style="column.width ? { width: column.width } : undefined"
            :aria-sort="
              sortKey === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
            "
          >
            <button
              v-if="column.sortable"
              type="button"
              class="ph-table__sort-button"
              @click="toggleSort(column)"
            >
              <span>{{ column.label }}</span>
              <PhIcon
                class="ph-table__sort-icon"
                :class="{ 'ph-table__sort-icon--inactive': sortKey !== column.key }"
                :name="sortKey === column.key && sortDirection === 'desc' ? 'ChevronDown' : 'ChevronUp'"
                size="xs"
              />
            </button>
            <span v-else>{{ column.label }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading">
          <tr v-for="n in skeletonRows" :key="`skeleton-${n}`" class="ph-table__row">
            <td v-for="column in columns" :key="column.key" class="ph-table__cell">
              <PhSkeleton height="14px" />
            </td>
          </tr>
        </template>
        <tr v-else-if="rows.length === 0">
          <td class="ph-table__empty-cell" :colspan="columns.length">
            <PhEmptyState :title="emptyTitle" :description="emptyDescription" />
          </td>
        </tr>
        <template v-else>
          <tr v-for="(row, index) in rows" :key="keyFor(row, index)" class="ph-table__row">
            <td v-for="column in columns" :key="column.key" class="ph-table__cell">
              <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]" :row-index="index">
                {{ row[column.key] }}
              </slot>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ph-table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.ph-table {
  width: 100%;
  border-collapse: collapse;
}

.ph-table__header {
  padding: var(--ph-space-2) var(--ph-space-3);
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-muted);
  text-align: left;
  text-transform: uppercase;
  border-bottom: 1px solid var(--ph-color-border-subtle);
  white-space: nowrap;
}

.ph-table__sort-button {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  color: inherit;
  font: inherit;
  text-transform: inherit;
}

.ph-table__sort-button:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
  border-radius: var(--ph-radius-sm);
}

.ph-table__sort-icon--inactive {
  opacity: 0.35;
}

.ph-table__row {
  border-bottom: 1px solid var(--ph-color-border-subtle);
}

.ph-table__row:last-child {
  border-bottom: none;
}

.ph-table__cell {
  padding: var(--ph-space-3);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  vertical-align: middle;
}

.ph-table__empty-cell {
  padding: 0;
}
</style>
