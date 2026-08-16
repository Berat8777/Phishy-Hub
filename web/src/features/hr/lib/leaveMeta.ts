import type { BadgeVariant } from '@phishyhub/design-system';
import type { LeaveRequestType } from '../../../api/types';

/**
 * Single source of truth for leave-type display strings — reused by
 * LeaveRequestForm, LeaveRequestRow, LeaveBalanceCard, CalendarLeavePill.
 *
 * `variant` is a distinct hue per TYPE (deliberately a different axis from
 * `LeaveStatusBadge.vue`'s `LEAVE_STATUS_META`, which colors by STATUS) —
 * `CalendarLeavePill` uses this to color-code "what kind of leave" while
 * separately encoding "how confirmed" (status) via solid-vs-outlined fill,
 * so the two dimensions never collide on the same visual channel.
 */
export const LEAVE_TYPE_META: Record<LeaveRequestType, { label: string; variant: BadgeVariant }> = {
  annual: { label: 'Annual', variant: 'accent' },
  sick: { label: 'Sick', variant: 'danger' },
  unpaid: { label: 'Unpaid', variant: 'warning' },
  other: { label: 'Other', variant: 'default' },
};

export const LEAVE_TYPE_OPTIONS: LeaveRequestType[] = ['annual', 'sick', 'unpaid', 'other'];
