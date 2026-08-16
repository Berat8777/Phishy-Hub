export const USER_ROLES = ['employee', 'developer', 'sales', 'hr', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended', 'pending'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CHANNEL_TYPES = ['public', 'private', 'dm'] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const CHANNEL_MEMBER_ROLES = ['member', 'admin'] as const;
export type ChannelMemberRole = (typeof CHANNEL_MEMBER_ROLES)[number];

export const MESSAGE_TYPES = ['text', 'system'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const FILE_STATUSES = ['uploading', 'ready', 'failed'] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

export const ATTACHABLE_TYPES = ['message', 'ticket', 'leave_request', 'meeting', 'user_avatar'] as const;
export type AttachableType = (typeof ATTACHABLE_TYPES)[number];

export const LEAVE_REQUEST_TYPES = ['annual', 'sick', 'unpaid', 'other'] as const;
export type LeaveRequestType = (typeof LEAVE_REQUEST_TYPES)[number];

// `manager_approved` is stage-2-pending: the requester's department manager
// (or hr/admin, who may skip straight past stage 1) has signed off, and the
// request now waits on hr/admin for the final decision. `pending` remains
// stage 1. See leaveRequest.service.ts for the full state machine.
export const LEAVE_REQUEST_STATUSES = ['pending', 'manager_approved', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

/** Statuses that still count toward "pending" balance usage / calendar visibility / overlap checks. */
export const LEAVE_REQUEST_ACTIVE_STATUSES: LeaveRequestStatus[] = ['pending', 'manager_approved', 'approved'];

export const LEAVE_REQUEST_REVIEW_STAGES = ['manager', 'hr'] as const;
export type LeaveRequestReviewStage = (typeof LEAVE_REQUEST_REVIEW_STAGES)[number];

export const LEAVE_REQUEST_REVIEW_DECISIONS = ['approve', 'reject'] as const;
export type LeaveRequestReviewDecision = (typeof LEAVE_REQUEST_REVIEW_DECISIONS)[number];

/** Only this leave type deducts against `LeaveBalance.entitledDays` (architect's assumption). */
export const LEAVE_TYPE_DEDUCTS_ENTITLEMENT: LeaveRequestType = 'annual';

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const RSVP_STATUSES = ['invited', 'accepted', 'declined', 'tentative'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

/** Roles allowed to review/approve/reject leave requests. */
export const LEAVE_REVIEWER_ROLES: UserRole[] = ['hr', 'admin'];

/** Access token lifetime in seconds — kept in sync with JWT_ACCESS_EXPIRES_IN for docs/UI hints. */
export const ACCESS_TOKEN_HINT_SECONDS = 15 * 60;
