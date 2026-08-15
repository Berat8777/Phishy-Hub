import { Op } from 'sequelize';
import { Message, User, FileAttachment, File } from '../models';
import { assertChannelMember, assertMessageEditable } from './authz.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { UserRole } from '../utils/constants';

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

export async function toMessageDTO(message: InstanceType<typeof Message>): Promise<MessageDTO> {
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
  const attachments = await loadAttachments(message.id);
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

export async function listMessages(
  userId: string,
  channelId: string,
  params: { before?: string; limit?: number },
): Promise<{ items: InstanceType<typeof Message>[]; hasMore: boolean }> {
  await assertChannelMember(userId, channelId);

  const limit = Math.min(100, Math.max(1, params.limit ?? 30));

  let cursorWhere = {};
  if (params.before) {
    const anchor = await Message.findByPk(params.before);
    if (!anchor) throw new BadRequestError('before does not reference an existing message');
    cursorWhere = {
      [Op.or]: [{ createdAt: { [Op.lt]: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { [Op.lt]: anchor.id } }],
    };
  }

  const rows = await Message.findAll({
    where: { channelId, ...cursorWhere },
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
