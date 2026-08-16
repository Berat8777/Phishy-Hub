/**
 * Hand-written DTOs mirroring api/CONTRACT.md exactly. Deliberately NOT
 * imported from the backend's api/src — that project has its own tsconfig,
 * pulls in Sequelize instance types, and is intentionally outside this
 * workspace (see repo CLAUDE.md). Keep this file in sync with CONTRACT.md
 * by hand when the contract changes.
 */

// --- Shared enums (api/src/utils/constants.ts) ---

export type UserRole = 'employee' | 'developer' | 'sales' | 'hr' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'pending';
export type ChannelType = 'public' | 'private' | 'dm';
export type ChannelMemberRole = 'member' | 'admin';
export type MessageType = 'text' | 'system';
export type FileStatus = 'uploading' | 'ready' | 'failed';
export type AttachableType = 'message' | 'ticket' | 'leave_request' | 'meeting' | 'user_avatar';

// --- Response envelope (CONTRACT.md §0) ---

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta | CursorMeta | Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CursorMeta {
  hasMore: boolean;
}

// --- Auth (CONTRACT.md §1) ---

export interface UserDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId: string | null;
  status: UserStatus;
  avatarFileId: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Department ids where this user is `Department.managerId` (CONTRACT.md
   * §3.3). Only populated on `POST /auth/register`, `POST /auth/login`, and
   * `GET /auth/me` — every other endpoint returning a UserDTO (e.g.
   * `GET /users`, `GET /users/:id`) always sends `[]` here, so this field is
   * only reliable read off `authStore.user`, never off `usersStore`.
   */
  managedDepartmentIds?: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires (from the moment it was issued). */
  accessTokenExpiresIn: number;
}

export interface LoginResponse extends TokenPair {
  user: UserDTO;
}

export interface RegisterResponse {
  user: UserDTO;
}

// --- Channels (CONTRACT.md §3.5) ---

export interface ChannelDTO {
  id: string;
  organizationId: string;
  name: string | null;
  type: ChannelType;
  departmentId: string | null;
  createdBy: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelLastMessagePreview {
  id: string;
  body: string | null;
  senderId: string;
  createdAt: string;
}

/** Extra fields present ONLY on GET /channels (list), not on GET /channels/:id. */
export interface ChannelListItemDTO extends ChannelDTO {
  unreadCount: number;
  lastReadMessageId: string | null;
  lastMessage: ChannelLastMessagePreview | null;
}

export interface ChannelMemberDTO {
  id: string;
  channelId: string;
  userId: string;
  channelRole: ChannelMemberRole;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  joinedAt: string;
}

/** `GET /channels/:channelId/attachments?type=image|file` — powers the channel-info panel's Media/Files tabs. */
export interface ChannelAttachmentDTO {
  fileId: string;
  messageId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

// --- Messages (CONTRACT.md §3.6) ---

export interface MessageReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
  /**
   * Only accurate on REST list/get responses. Socket broadcasts fan the
   * same payload to an entire room with no per-viewer computation, so this
   * is always `false` there — check `userIds` against the local user id
   * instead when reacting to socket events.
   */
  reactedByMe: boolean;
}

export interface MessageAttachmentDTO {
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MessageSenderDTO {
  id: string;
  firstName: string;
  lastName: string;
  avatarFileId: string | null;
}

export interface MessageDTO {
  id: string;
  channelId: string;
  senderId: string;
  sender: MessageSenderDTO | null;
  body: string | null;
  type: MessageType;
  replyToMessageId: string | null;
  editedAt: string | null;
  attachments: MessageAttachmentDTO[];
  reactions: MessageReactionSummary[];
  replyCount: number;
  lastReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Files (CONTRACT.md §3.7) ---

export interface FileDTO {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
  hasThumbnail: boolean;
  uploadedById: string;
  createdAt: string;
}

export interface FileDownloadResponse {
  url: string;
  expiresInSeconds: number;
  file: FileDTO;
}

// --- Departments (CONTRACT.md §3.4) ---

export interface DepartmentDTO {
  id: string;
  organizationId: string;
  name: string;
  /** Department manager relationship, not a role — nullable (CONTRACT.md §3.4). */
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Tickets (CONTRACT.md §3.9) ---

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TicketPersonDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface TicketDepartmentDTO {
  id: string;
  name: string;
}

export interface TicketDTO {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  createdById: string;
  assignedToId: string | null;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
  creator: TicketPersonDTO | null;
  assignee: TicketPersonDTO | null;
  department: TicketDepartmentDTO | null;
}

export interface TicketCommentAuthorDTO {
  id: string;
  firstName: string;
  lastName: string;
  avatarFileId: string | null;
}

export interface TicketCommentDTO {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: TicketCommentAuthorDTO | null;
}

// --- Leave requests (CONTRACT.md §3.8) — minimal shape needed by lib/permissions.ts; the HR pass owns the full feature ---

export type LeaveRequestType = 'annual' | 'sick' | 'unpaid' | 'other';
export type LeaveRequestStatus = 'pending' | 'manager_approved' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequestPersonDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string | null;
  avatarFileId: string | null;
}

export interface LeaveRequestDTO {
  id: string;
  userId: string;
  type: LeaveRequestType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveRequestStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  requester: LeaveRequestPersonDTO | null;
  reviewer: LeaveRequestPersonDTO | null;
}

export type LeaveRequestReviewStage = 'manager' | 'hr';
export type LeaveRequestReviewDecision = 'approve' | 'reject';

/**
 * `POST /leave-requests/:id/review` request body (CONTRACT.md §3.8 — the
 * "breaking change" shape, `{decision, reviewNote?}`, NOT the old
 * `{status: 'approved'|'rejected'}`).
 *
 * NOTE: this is deliberately NOT the `leave_request_reviews` audit-trail row
 * shape (`id, leaveRequestId, reviewerId, stage, decision, note, createdAt`)
 * — that table exists in the DB (migration `20260101001800`) and the model
 * association (`LeaveRequest.hasMany(LeaveRequestReview, {as:'reviews'})`)
 * exists, but as of this pass NO REST endpoint actually serializes/exposes
 * it (`leaveRequest.service.ts`'s `REQUESTER_INCLUDE` only eager-loads
 * `requester`/`reviewer`, never `reviews`, and there is no
 * `/leave-requests/:id/reviews` route). `LeaveRequestDTO.reviewedById` /
 * `reviewedAt` / `reviewNote` are themselves only a denormalized pointer to
 * the LAST decision (CONTRACT.md §3.8), so a fully-approved request's
 * stage-1 (manager) reviewer identity is not recoverable via any current
 * endpoint. `ApprovalChainStepper.vue` renders around this limitation —
 * see its doc comment and this pass's HANDOFF for the recommended backend
 * follow-up.
 */
export interface LeaveRequestReviewDTO {
  decision: LeaveRequestReviewDecision;
  reviewNote?: string;
}

/** `GET /leave-requests/balance` entry (CONTRACT.md §3.8) — one per `LeaveRequestType`. */
export interface LeaveBalanceDTO {
  type: LeaveRequestType;
  entitledDays: number;
  carriedOverDays: number;
  usedDays: number;
  pendingDays: number;
  /** `null` for types that don't deduct against entitlement — only `'annual'` does (CONTRACT.md §3.8). */
  remainingDays: number | null;
}

/**
 * `GET /leave-calendar` entry (CONTRACT.md §3.8/§11.2) — a structurally
 * distinct, redacted projection, NOT a filtered `LeaveRequestDTO`.
 * `reason`/`reviewNote` are never present.
 */
export interface LeaveCalendarEntryDTO {
  id: string;
  userId: string;
  user: { id: string; firstName: string; lastName: string; avatarFileId: string | null; departmentId: string | null };
  type: LeaveRequestType;
  status: LeaveRequestStatus;
  startDate: string;
  endDate: string;
}

// --- Notifications (CONTRACT.md §3.11) ---

export type NotificationType = 'leave_request_reviewed' | 'ticket_assigned' | 'meeting_invite' | string;

export interface NotificationDTO {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Health ---

export interface HealthResponse {
  status: string;
  db: string;
  uptimeSeconds: number;
  timestamp: string;
}
