<script lang="ts">
import type { BadgeVariant } from '@phishyhub/design-system';
import type { LeaveRequestStatus } from '../../../api/types';

/** Single source of truth for leave-request status display strings/colors — reused by LeaveRequestRow, LeaveApprovalsView, CalendarLeavePill. */
export const LEAVE_STATUS_META: Record<LeaveRequestStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pending', variant: 'warning' },
  manager_approved: { label: 'Manager approved', variant: 'accent' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'default' },
};
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { PhBadge } from '@phishyhub/design-system';

const props = defineProps<{ status: LeaveRequestStatus }>();
const meta = computed(() => LEAVE_STATUS_META[props.status]);
</script>

<template>
  <PhBadge :variant="meta.variant">{{ meta.label }}</PhBadge>
</template>
