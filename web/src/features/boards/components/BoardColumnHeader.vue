<script lang="ts">
import type { IconName } from '@phishyhub/design-system';
import type { TicketStatus } from '../../../api/types';

export interface TicketStatusMeta {
  label: string;
  icon: IconName;
}

/**
 * Single source of truth for status display strings/icons — reused by
 * KanbanBoardView (feeding `PhBoardColumn`'s `title` prop, which only
 * accepts a plain string), TicketStatusSelect's dropdown options, and this
 * component's own compact status badge (shown on `TicketCard` — useful
 * beyond the column's positional meaning e.g. for screen readers).
 */
export const TICKET_STATUS_META: Record<TicketStatus, TicketStatusMeta> = {
  open: { label: 'Open', icon: 'CircleDot' },
  in_progress: { label: 'In Progress', icon: 'Loader' },
  resolved: { label: 'Resolved', icon: 'CircleCheck' },
  closed: { label: 'Closed', icon: 'CircleX' },
};

export const TICKET_STATUS_ORDER: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { PhIcon } from '@phishyhub/design-system';

const props = defineProps<{ status: TicketStatus }>();
const meta = computed(() => TICKET_STATUS_META[props.status]);
</script>

<template>
  <span class="board-column-header">
    <PhIcon :name="meta.icon" size="xs" />
    <span>{{ meta.label }}</span>
  </span>
</template>

<style scoped>
.board-column-header {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-muted);
}
</style>
