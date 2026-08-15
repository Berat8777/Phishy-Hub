import { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import { parsePaginationQuery } from '../services/pagination.service';
import { sendSuccess } from '../utils/response';

export async function list(req: Request, res: Response): Promise<void> {
  const { items, meta } = await notificationService.listNotifications(req.user!.id, {
    ...parsePaginationQuery(req.query),
    isRead: req.query.isRead === undefined ? undefined : req.query.isRead === 'true',
  });
  sendSuccess(res, items, 200, meta);
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const notification = await notificationService.markAsRead(req.user!.id, (req.params.id as string));
  sendSuccess(res, notification);
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  await notificationService.markAllAsRead(req.user!.id);
  sendSuccess(res, { updated: true });
}
