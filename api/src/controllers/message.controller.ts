import { Request, Response } from 'express';
import * as messageService from '../services/message.service';
import { getIo } from '../sockets';
import { broadcastMessageDeleted, broadcastMessageUpdated, broadcastNewMessage } from '../sockets/broadcast';
import { sendSuccess } from '../utils/response';

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
  const dtos = await Promise.all(items.map((m) => messageService.toMessageDTO(m)));
  sendSuccess(res, dtos, 200, { hasMore });
}

export async function create(req: Request, res: Response): Promise<void> {
  const message = await messageService.createMessage({
    channelId: (req.params.channelId as string),
    senderId: req.user!.id,
    body: req.body.body,
    replyToMessageId: req.body.replyToMessageId,
    fileIds: req.body.fileIds,
  });
  const dto = await messageService.toMessageDTO(message);

  const io = tryGetIo();
  if (io) broadcastNewMessage(io, dto);

  sendSuccess(res, dto, 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const message = await messageService.editMessage(req.user!.id, req.user!.role, (req.params.messageId as string), req.body.body);
  const dto = await messageService.toMessageDTO(message);

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
