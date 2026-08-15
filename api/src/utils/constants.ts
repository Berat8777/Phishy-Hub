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

export const LEAVE_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

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
