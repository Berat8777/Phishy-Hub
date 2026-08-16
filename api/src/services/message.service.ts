import { Op } from 'sequelize';
import { Message, User, FileAttachment, File, MessageReaction, ChannelMember } from '../models';
import { assertChannelMember, assertMessageEditable } from './authz.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { paginate, PaginationParams } from './pagination.service';
import type { PaginationMeta } from '../utils/response';
import type { UserRole } from '../utils/constants';

export interface ChannelAttachmentDTO {
  fileId: string;
  messageId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface MessageReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe: boolean;
}

export interface MessageDTO {
  id: string;
  channelId: string;
  senderId: string;
  sender: { id: string; firstName: string; lastName: string; avatarFileId: string | null } | null;
  body: string | null;
  type: string;
  replyToMessageId: string | null;
  editedAt: string | null;
  attachments: { fileId: string; originalName: string; mimeType: string; sizeBytes: number }[];
  reactions: MessageReactionSummary[];
  replyCount: number;
  lastReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const SENDER_INCLUDE = { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'avatarFileId'] };

async function loadAttachments(messageId: string) {
  const attachments = await FileAttachment.findAll({
    where: { attachableType: 'message', attachableId: messageId },
    include: [{ model: File, as: 'file' }],
  });
  return attachments.map((a) => {
    const file = a.get('file') as InstanceType<typeof File>;
    return { fileId: file.id, originalName: file.originalName, mimeType: file.mimeType, sizeBytes: Number(file.sizeBytes) };
  });
}

async function loadReactions(messageId: string, viewerUserId?: string): Promise<MessageReactionSummary[]> {
  const reactions = await MessageReaction.findAll({ where: { messageId } });
  const byEmoji = new Map<string, string[]>();
  for (const reaction of reactions) {
    const existing = byEmoji.get(reaction.emoji);
    if (existing) existing.push(reaction.userId);
    else byEmoji.set(reaction.emoji, [reaction.userId]);
  }
  return Array.from(byEmoji.entries()).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    userIds,
    reactedByMe: viewerUserId ? userIds.includes(viewerUserId) : false,
  }));
}

async function loadReplyStats(messageId: string): Promise<{ replyCount: number; lastReplyAt: string | null }> {
  const [replyCount, lastReplyAtRaw] = await Promise.all([
    Message.count({ where: { replyToMessageId: messageId } }),
    Message.max('createdAt', { where: { replyToMessageId: messageId } }) as Promise<Date | string | null>,
  ]);
  return { replyCount, lastReplyAt: lastReplyAtRaw ? new Date(lastReplyAtRaw).toISOString() : null };
}

/**
 * `viewerUserId` drives `reactions[].reactedByMe` — REST list/get callers
 * always have the requesting user's id and should pass it. Socket broadcasts
 * fan the same payload out to an entire `channel:{id}` room (no single
 * "viewer"), so handlers/message.handler.ts and message.controller.ts's
 * create/update paths call this without it; `reactedByMe` then defaults to
 * false for every reaction in that broadcast payload. This is an accepted
 * simplification consistent with the rest of this codebase's broadcast model
 * (e.g. sender info is likewise identical for every recipient).
 */
export async function toMessageDTO(message: InstanceType<typeof Message>, viewerUserId?: string): Promise<MessageDTO> {
  const json = message.toJSON();
  const senderAssociation = message.sender;
  const sender = senderAssociation
    ? {
        id: senderAssociation.id,
        firstName: senderAssociation.firstName,
        lastName: senderAssociation.lastName,
        avatarFileId: senderAssociation.avatarFileId ?? null,
      }
    : null;
  const [attachments, reactions, replyStats] = await Promise.all([
    loadAttachments(message.id),
    loadReactions(message.id, viewerUserId),
    loadReplyStats(message.id),
  ]);
  return {
    id: json.id,
    channelId: json.channelId,
    senderId: json.senderId,
    sender,
    body: json.body ?? null,
    type: json.type,
    replyToMessageId: json.replyToMessageId ?? null,
    editedAt: json.editedAt ? new Date(json.editedAt).toISOString() : null,
    attachments,
    reactions,
    replyCount: replyStats.replyCount,
    lastReplyAt: replyStats.lastReplyAt,
    createdAt: new Date(json.createdAt).toISOString(),
    updatedAt: new Date(json.updatedAt).toISOString(),
  };
}

/**
 * Single entry point for message creation — called from both the REST
 * `POST /channels/:id/messages` handler and the `message:send` socket
 * handler (architecture doc §4 "mesaj yaratma tekilleştirmesi"). Real-time
 * fan-out (`message:new`) is done by the caller, not here, so this module
 * has no dependency on the sockets layer.
 */
export async function createMessage(input: {
  channelId: string;
  senderId: string;
  body?: string | null;
  replyToMessageId?: string | null;
  fileIds?: string[];
}): Promise<InstanceType<typeof Message>> {
  await assertChannelMember(input.senderId, input.channelId);

  const trimmedBody = input.body?.trim() || null;
  if (!trimmedBody && (!input.fileIds || input.fileIds.length === 0)) {
    throw new BadRequestError('Message must have a body or at least one attachment');
  }

  if (input.replyToMessageId) {
    const parent = await Message.findOne({ where: { id: input.replyToMessageId, channelId: input.channelId } });
    if (!parent) throw new BadRequestError('replyToMessageId does not reference a message in this channel');
  }

  const message = await Message.create({
    channelId: input.channelId,
    senderId: input.senderId,
    body: trimmedBody,
    type: 'text',
    replyToMessageId: input.replyToMessageId ?? null,
  });

  if (input.fileIds && input.fileIds.length > 0) {
    await FileAttachment.bulkCreate(
      input.fileIds.map((fileId) => ({ fileId, attachableType: 'message' as const, attachableId: message.id })),
    );
  }

  const loaded = await Message.findByPk(message.id, { include: [SENDER_INCLUDE] });
  return loaded!;
}

/**
 * Builds the `Op.or` keyset-pagination fragment shared by the main channel
 * timeline and the thread-replies endpoint: `createdAt DESC, id DESC`
 * tiebreaker, same as CONTRACT.md §2.2.
 */
async function buildCursorWhere(before: string | undefined): Promise<Record<string, unknown>> {
  if (!before) return {};
  const anchor = await Message.findByPk(before);
  if (!anchor) throw new BadRequestError('before does not reference an existing message');
  return {
    [Op.or]: [{ createdAt: { [Op.lt]: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { [Op.lt]: anchor.id } }],
  };
}

export async function listMessages(
  userId: string,
  channelId: string,
  params: { before?: string; limit?: number },
): Promise<{ items: InstanceType<typeof Message>[]; hasMore: boolean }> {
  await assertChannelMember(userId, channelId);

  const limit = Math.min(100, Math.max(1, params.limit ?? 30));
  const cursorWhere = await buildCursorWhere(params.before);

  const rows = await Message.findAll({
    // `replyToMessageId: null` is part of the same WHERE the cursor
    // comparison runs against (not a post-filter) — thread replies are only
    // reachable via listReplies() below, keeping the pagination math intact.
    where: { channelId, replyToMessageId: null, ...cursorWhere },
    include: [SENDER_INCLUDE],
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  return { items: rows.slice(0, limit), hasMore };
}

export async function listReplies(
  userId: string,
  messageId: string,
  params: { before?: string; limit?: number },
): Promise<{ items: InstanceType<typeof Message>[]; hasMore: boolean }> {
  const parent = await Message.findByPk(messageId);
  if (!parent) throw new NotFoundError('Message not found');
  await assertChannelMember(userId, parent.channelId);

  const limit = Math.min(100, Math.max(1, params.limit ?? 30));
  const cursorWhere = await buildCursorWhere(params.before);

  const rows = await Message.findAll({
    where: { replyToMessageId: messageId, ...cursorWhere },
    include: [SENDER_INCLUDE],
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  return { items: rows.slice(0, limit), hasMore };
}

/**
 * `GET /channels/:channelId/attachments?type=image|file` — powers the
 * channel-info panel's Media/Files tabs. Not paginable directly off
 * `FileAttachment`'s own attributes (the channel relationship only exists
 * via the polymorphic `attachableId -> Message.channelId` hop, which
 * `pagination.service.ts::paginate()` can't express as a join condition),
 * so this first collects the channel's message ids and then paginates
 * `FileAttachment` scoped to `attachableId IN (those ids)` — same
 * two-step shape as `buildCursorWhere`'s single-row lookup above, just for
 * a set instead of one anchor row.
 */
export async function listChannelAttachments(
  userId: string,
  channelId: string,
  params: PaginationParams & { type: 'image' | 'file' },
): Promise<{ items: ChannelAttachmentDTO[]; meta: PaginationMeta }> {
  await assertChannelMember(userId, channelId);

  const messages = await Message.findAll({ where: { channelId }, attributes: ['id'] });
  const messageIds = messages.map((m) => m.id);

  if (messageIds.length === 0) {
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
    return { items: [], meta: { page: 1, pageSize, total: 0, totalPages: 1 } };
  }

  const mimeWhere = params.type === 'image' ? { [Op.iLike]: 'image/%' } : { [Op.notILike]: 'image/%' };

  const { items, meta } = await paginate(
    FileAttachment,
    params,
    {
      where: { attachableType: 'message', attachableId: { [Op.in]: messageIds } },
      include: [
        {
          model: File,
          as: 'file',
          required: true,
          where: { mimeType: mimeWhere },
          include: [{ model: User, as: 'uploadedBy', attributes: ['id', 'firstName', 'lastName'] }],
        },
      ],
    },
    'createdAt',
  );

  const dtos: ChannelAttachmentDTO[] = items.map((attachment) => {
    const file = attachment.get('file') as InstanceType<typeof File> & { uploadedBy?: InstanceType<typeof User> };
    const uploadedBy = file.uploadedBy;
    return {
      fileId: file.id,
      messageId: attachment.attachableId,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: Number(file.sizeBytes),
      uploadedBy: uploadedBy ? { id: uploadedBy.id, firstName: uploadedBy.firstName, lastName: uploadedBy.lastName } : null,
      createdAt: new Date(attachment.createdAt).toISOString(),
    };
  });

  return { items: dtos, meta };
}

export async function editMessage(
  userId: string,
  role: UserRole,
  messageId: string,
  body: string,
): Promise<InstanceType<typeof Message>> {
  const message = await Message.findByPk(messageId, { include: [SENDER_INCLUDE] });
  if (!message) throw new NotFoundError('Message not found');
  assertMessageEditable(message.senderId, userId, role);

  message.body = body.trim();
  message.editedAt = new Date();
  await message.save();
  return message;
}

export async function deleteMessage(userId: string, role: UserRole, messageId: string): Promise<{ channelId: string }> {
  const message = await Message.findByPk(messageId);
  if (!message) throw new NotFoundError('Message not found');
  assertMessageEditable(message.senderId, userId, role);

  const channelId = message.channelId;
  await message.destroy();
  return { channelId };
}

export async function markRead(
  userId: string,
  channelId: string,
  lastReadMessageId: string,
): Promise<{ channelId: string; userId: string; lastReadMessageId: string; readAt: string }> {
  const membership = await assertChannelMember(userId, channelId);

  const message = await Message.findOne({ where: { id: lastReadMessageId, channelId } });
  if (!message) throw new BadRequestError('lastReadMessageId does not reference a message in this channel');

  const readAt = new Date();
  membership.lastReadMessageId = lastReadMessageId;
  membership.lastReadAt = readAt;
  await membership.save();

  logger.debug({ userId, channelId, lastReadMessageId }, 'message:read');

  return { channelId, userId, lastReadMessageId, readAt: readAt.toISOString() };
}

/**
 * Adds `userId`'s reaction to a message — idempotent: reacting with an emoji
 * already on record for this (message, user) pair is a no-op success rather
 * than a conflict, per the product spec. Caller must be a member of the
 * message's channel, same check `createMessage` uses.
 */
export async function addReaction(
  userId: string,
  messageId: string,
  emoji: string,
): Promise<{ message: InstanceType<typeof Message>; created: boolean }> {
  const message = await Message.findByPk(messageId, { include: [SENDER_INCLUDE] });
  if (!message) throw new NotFoundError('Message not found');
  await assertChannelMember(userId, message.channelId);

  const trimmedEmoji = emoji.trim();
  if (!trimmedEmoji) throw new BadRequestError('emoji is required');

  const [, created] = await MessageReaction.findOrCreate({
    where: { messageId, userId, emoji: trimmedEmoji },
    defaults: { messageId, userId, emoji: trimmedEmoji },
  });

  return { message, created };
}

/** Removes the caller's own reaction. Idempotent: removing a reaction that isn't there is still a success. */
export async function removeReaction(
  userId: string,
  messageId: string,
  emoji: string,
): Promise<{ message: InstanceType<typeof Message>; removed: boolean }> {
  const message = await Message.findByPk(messageId, { include: [SENDER_INCLUDE] });
  if (!message) throw new NotFoundError('Message not found');
  await assertChannelMember(userId, message.channelId);

  const trimmedEmoji = emoji.trim();
  if (!trimmedEmoji) throw new BadRequestError('emoji is required');

  const destroyed = await MessageReaction.destroy({ where: { messageId, userId, emoji: trimmedEmoji } });
  return { message, removed: destroyed > 0 };
}

/**
 * `GET /messages/search` — Postgres `ILIKE '%term%'` on message body (v1,
 * no tsvector column — out of scope per the spec). Scoped to channels the
 * caller belongs to; `channelId` narrows to just that one (membership
 * re-checked). Reuses pagination.service's offset paginate() since this is
 * just a filtered query on Message's own attributes, not a cross-table
 * aggregate — no need for a bespoke pagination path.
 */
export async function searchMessages(
  userId: string,
  params: PaginationParams & { q: string; channelId?: string },
): Promise<{ items: InstanceType<typeof Message>[]; meta: PaginationMeta }> {
  const term = params.q?.trim();
  if (!term) throw new BadRequestError('q is required');

  let channelIds: string[];
  if (params.channelId) {
    await assertChannelMember(userId, params.channelId);
    channelIds = [params.channelId];
  } else {
    const memberships = await ChannelMember.findAll({ where: { userId }, attributes: ['channelId'] });
    channelIds = memberships.map((m) => m.channelId);
  }

  if (channelIds.length === 0) {
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
    return { items: [], meta: { page: 1, pageSize, total: 0, totalPages: 1 } };
  }

  return paginate(
    Message,
    params,
    {
      where: {
        channelId: { [Op.in]: channelIds },
        body: { [Op.iLike]: `%${term}%` },
      },
      include: [SENDER_INCLUDE],
    },
    'createdAt',
  );
}
