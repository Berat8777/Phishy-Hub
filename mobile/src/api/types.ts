/**
 * Hand-written DTOs mirroring api/CONTRACT.md exactly (ported from
 * web/src/api/types.ts, trimmed to what this client actually consumes —
 * channels/messages/auth/files. See CONTRACT.md for the full contract, and
 * keep this file in sync by hand when it changes.
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
  /** Only accurate on REST list/get responses — always `false` on socket broadcasts, see CONTRACT.md §3.6. */
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

// --- Health ---

export interface HealthResponse {
  status: string;
  db: string;
  uptimeSeconds: number;
  timestamp: string;
}
