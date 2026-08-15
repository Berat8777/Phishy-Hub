import { Notification } from '../models';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { paginate, PaginationParams } from './pagination.service';
import { getIo } from '../sockets';
import { broadcastNotification } from '../sockets/broadcast';
import { logger } from '../utils/logger';

export async function createNotification(
  userId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<InstanceType<typeof Notification>> {
  const notification = await Notification.create({ userId, type, payload, isRead: false });

  try {
    broadcastNotification(getIo(), userId, notification.toJSON());
  } catch (err) {
    // Socket layer not initialized (e.g. scripts/tests) — persisted row is still created.
    logger.debug({ err }, 'skipped realtime notification broadcast');
  }

  return notification;
}

export async function listNotifications(userId: string, params: PaginationParams & { isRead?: boolean }) {
  const where: Record<string, unknown> = { userId };
  if (params.isRead !== undefined) where.isRead = params.isRead;
  return paginate(Notification, params, { where });
}

export async function markAsRead(userId: string, id: string): Promise<InstanceType<typeof Notification>> {
  const notification = await Notification.findByPk(id);
  if (!notification) throw new NotFoundError('Notification not found');
  if (notification.userId !== userId) throw new ForbiddenError('Not your notification');
  notification.isRead = true;
  await notification.save();
  return notification;
}

export async function markAllAsRead(userId: string): Promise<void> {
  await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
}
