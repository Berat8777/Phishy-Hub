<script lang="ts">
import type { BadgeVariant } from '@phishyhub/design-system';
import type { TicketPriority } from '../../../api/types';

/** Single source of truth for priority display strings/colors — reused by TicketCard, TicketCreateDialog, and BoardFilterBar's filter options. */
export const TICKET_PRIORITY_META: Record<TicketPriority, { label: string; variant: BadgeVariant }> = {
  low: { label: 'Low', variant: 'default' },
  medium: { label: 'Medium', variant: 'accent' },
  high: { label: 'High', variant: 'warning' },
  urgent: { label: 'Urgent', variant: 'danger' },
};

export const TICKET_PRIORITY_OPTIONS: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { PhBadge } from '@phishyhub/design-system';

const props = defineProps<{ priority: TicketPriority }>();
const meta = computed(() => TICKET_PRIORITY_META[props.priority]);
</script>

<template>
  <PhBadge :variant="meta.variant">{{ meta.label }}</PhBadge>
</template>
