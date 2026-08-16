import { Request, Response } from 'express';
import * as channelService from '../services/channel.service';
import * as messageService from '../services/message.service';
import { parsePaginationQuery } from '../services/pagination.service';
import { sendSuccess } from '../utils/response';

export async function list(req: Request, res: Response): Promise<void> {
  const { items, meta } = await channelService.listMyChannels(req.user!.id, {
    ...parsePaginationQuery(req.query),
    type: req.query.type as never,
  });
  const dtos = await channelService.attachChannelListMeta(req.user!.id, items);
  sendSuccess(res, dtos, 200, meta);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const channel = await channelService.getChannel(req.user!.id, (req.params.channelId as string));
  sendSuccess(res, channel);
}

export async function create(req: Request, res: Response): Promise<void> {
  const channel = await channelService.createChannel(req.user!.id, req.body);
  sendSuccess(res, channel, 201);
}

export async function createOrGetDm(req: Request, res: Response): Promise<void> {
  const { channel, created } = await channelService.getOrCreateDmChannel(req.user!.id, req.body.userIds);
  sendSuccess(res, channel, created ? 201 : 200);
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  const members = await channelService.listMembers(req.user!.id, (req.params.channelId as string));
  sendSuccess(res, members);
}

export async function join(req: Request, res: Response): Promise<void> {
  const membership = await channelService.joinChannel(req.user!.id, (req.params.channelId as string));
  sendSuccess(res, membership, 201);
}

export async function leave(req: Request, res: Response): Promise<void> {
  await channelService.leaveChannel(req.user!.id, (req.params.channelId as string));
  sendSuccess(res, { left: true });
}

export async function addMember(req: Request, res: Response): Promise<void> {
  const membership = await channelService.addMember(
    req.user!.id,
    req.user!.role,
    (req.params.channelId as string),
    req.body.userId,
  );
  sendSuccess(res, membership, 201);
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  await channelService.removeMember(req.user!.id, req.user!.role, (req.params.channelId as string), (req.params.userId as string));
  sendSuccess(res, { removed: true });
}

export async function listAttachments(req: Request, res: Response): Promise<void> {
  const { items, meta } = await messageService.listChannelAttachments(req.user!.id, (req.params.channelId as string), {
    ...parsePaginationQuery(req.query),
    type: req.query.type as 'image' | 'file',
  });
  sendSuccess(res, items, 200, meta);
}

export async function archive(req: Request, res: Response): Promise<void> {
  const channel = await channelService.archiveChannel(req.user!.id, req.user!.role, (req.params.channelId as string));
  sendSuccess(res, channel);
}
