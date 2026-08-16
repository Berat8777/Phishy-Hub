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
