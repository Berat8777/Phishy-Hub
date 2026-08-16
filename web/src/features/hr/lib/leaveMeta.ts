import type { LeaveRequestType } from '../../../api/types';

/** Single source of truth for leave-type display strings — reused by LeaveRequestForm, LeaveRequestRow, LeaveBalanceCard, CalendarLeavePill. */
export const LEAVE_TYPE_META: Record<LeaveRequestType, { label: string }> = {
  annual: { label: 'Annual' },
  sick: { label: 'Sick' },
  unpaid: { label: 'Unpaid' },
  other: { label: 'Other' },
};

export const LEAVE_TYPE_OPTIONS: LeaveRequestType[] = ['annual', 'sick', 'unpaid', 'other'];
