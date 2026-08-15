import { Server } from 'socket.io';
import { User } from '../../models';
import { logger } from '../../utils/logger';

/**
 * v1 presence: in-memory only, single process (architecture doc §4 —
 * "Redis adapter yok, çoklu API instance kapsam dışı"). Tracks every socket
 * id per user so multi-tab/multi-device users don't flip to "offline" the
 * moment one tab closes.
 */
const onlineSockets = new Map<string, Set<string>>();
const offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();

const OFFLINE_GRACE_MS = 8000;

function broadcastPresence(io: Server, userId: string, status: 'online' | 'offline', lastSeenAt?: Date): void {
  io.emit('presence:update', {
    userId,
    status,
    lastSeenAt: (lastSeenAt ?? new Date()).toISOString(),
  });
}

export function markUserOnline(io: Server, userId: string, socketId: string): void {
  const existing = offlineTimers.get(userId);
  if (existing) {
    clearTimeout(existing);
    offlineTimers.delete(userId);
  }

  const wasOffline = !onlineSockets.has(userId) || onlineSockets.get(userId)!.size === 0;
  if (!onlineSockets.has(userId)) {
    onlineSockets.set(userId, new Set());
  }
  onlineSockets.get(userId)!.add(socketId);

  if (wasOffline) {
    broadcastPresence(io, userId, 'online');
  }
}

export function markUserOffline(io: Server, userId: string, socketId: string): void {
  const sockets = onlineSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size > 0) return;

  // Grace period: a client that reconnects (e.g. after refreshing its
  // 15-minute access token — architecture doc §4 known limitation) within
  // this window never visibly flickers to "offline".
  const timer = setTimeout(() => {
    void (async () => {
      const stillEmpty = (onlineSockets.get(userId)?.size ?? 0) === 0;
      if (!stillEmpty) return;
      onlineSockets.delete(userId);
      offlineTimers.delete(userId);

      const lastSeenAt = new Date();
      try {
        await User.update({ lastSeenAt }, { where: { id: userId } });
      } catch (err) {
        logger.error({ err, userId }, 'failed to persist lastSeenAt on disconnect');
      }
      broadcastPresence(io, userId, 'offline', lastSeenAt);
    })();
  }, OFFLINE_GRACE_MS);
  offlineTimers.set(userId, timer);
}

export function isUserOnline(userId: string): boolean {
  return (onlineSockets.get(userId)?.size ?? 0) > 0;
}
