import { Request, Response } from 'express';
import * as messageService from '../services/message.service';
import { getIo } from '../sockets';
import {
  broadcastMessageDeleted,
  broadcastMessageUpdated,
  broadcastNewMessage,
  broadcastReactionAdded,
  broadcastReactionRemoved,
} from '../sockets/broadcast';
import { parsePaginationQuery } from '../services/pagination.service';
import { sendSuccess } from '../utils/response';
import { logger } from '../utils/logger';
import { handleMessageForAiMention } from '../services/ai/aiMention.service';

function tryGetIo() {
  try {
    return getIo();
  } catch {
    return null;
  }
}

export async function list(req: Request, res: Response): Promise<void> {
  const { items, hasMore } = await messageService.listMessages(req.user!.id, (req.params.channelId as string), {
    before: req.query.before as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  const dtos = await Promise.all(items.map((m) => messageService.toMessageDTO(m, req.user!.id)));
  sendSuccess(res, dtos, 200, { hasMore });
}

export async function listReplies(req: Request, res: Response): Promise<void> {
  const { items, hasMore } = await messageService.listReplies(req.user!.id, (req.params.messageId as string), {
    before: req.query.before as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  const dtos = await Promise.all(items.map((m) => messageService.toMessageDTO(m, req.user!.id)));
  sendSuccess(res, dtos, 200, { hasMore });
}

export async function search(req: Request, res: Response): Promise<void> {
  const { q, ...pagination } = parsePaginationQuery(req.query);
  const { items, meta } = await messageService.searchMessages(req.user!.id, {
    ...pagination,
    q: q ?? '',
    channelId: req.query.channelId as string | undefined,
  });
  const dtos = await Promise.all(items.map((m) => messageService.toMessageDTO(m, req.user!.id)));
  sendSuccess(res, dtos, 200, meta);
}

export async function create(req: Request, res: Response): Promise<void> {
  const message = await messageService.createMessage({
    channelId: (req.params.channelId as string),
    senderId: req.user!.id,
    body: req.body.body,
    replyToMessageId: req.body.replyToMessageId,
    fileIds: req.body.fileIds,
  });
  const dto = await messageService.toMessageDTO(message, req.user!.id);

  const io = tryGetIo();
  // `tempId` is purely a client-side broadcast-correlation token (see
  // createMessageValidator) — passing it through here mirrors what the
  // socket `message:send` handler already does with `payload.tempId`, so a
  // REST-created message's broadcast can be reconciled against the
  // sender's own optimistic row by tempId, the same way, instead of the
  // client having to guess which pending send a tempId-less broadcast
  // belongs to (ambiguous the moment the same user has two active clients
  // in the same channel).
  if (io) broadcastNewMessage(io, dto, req.body.tempId);

  // Fire-and-forget: `@ai` mention handling never blocks/affects the
  // response to the message-sending request itself (see aiMention.service.ts
  // for why this can't live inside message.service.ts::createMessage).
  void handleMessageForAiMention(dto, req.user!.role).catch((err) => {
    logger.warn({ err, messageId: dto.id }, 'ai mention handling failed');
  });

  sendSuccess(res, dto, 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const message = await messageService.editMessage(req.user!.id, req.user!.role, (req.params.messageId as string), req.body.body);
  const dto = await messageService.toMessageDTO(message, req.user!.id);

  const io = tryGetIo();
  if (io) broadcastMessageUpdated(io, dto);

  sendSuccess(res, dto);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { channelId } = await messageService.deleteMessage(req.user!.id, req.user!.role, (req.params.messageId as string));

  const io = tryGetIo();
  if (io) broadcastMessageDeleted(io, channelId, (req.params.messageId as string));

  sendSuccess(res, { deleted: true });
}

export async function addReaction(req: Request, res: Response): Promise<void> {
  const { message, created } = await messageService.addReaction(req.user!.id, (req.params.messageId as string), req.body.emoji);
  const dto = await messageService.toMessageDTO(message, req.user!.id);

  if (created) {
    const io = tryGetIo();
    if (io) broadcastReactionAdded(io, { channelId: message.channelId, messageId: message.id, emoji: req.body.emoji, userId: req.user!.id });
  }

  sendSuccess(res, dto);
}

export async function removeReaction(req: Request, res: Response): Promise<void> {
  const emoji = (req.body.emoji ?? req.query.emoji) as string;
  const { message, removed } = await messageService.removeReaction(req.user!.id, (req.params.messageId as string), emoji);
  const dto = await messageService.toMessageDTO(message, req.user!.id);

  if (removed) {
    const io = tryGetIo();
    if (io) broadcastReactionRemoved(io, { channelId: message.channelId, messageId: message.id, emoji, userId: req.user!.id });
  }

  sendSuccess(res, dto);
}
