import { http } from '../http';
import type { NotificationDTO } from '../types';

export function listNotifications(params?: { isRead?: boolean }): Promise<NotificationDTO[]> {
  return http.get<NotificationDTO[]>('/notifications', { query: params }).then((r) => r.data);
}

export function markAllRead(): Promise<void> {
  return http.post('/notifications/read-all').then(() => undefined);
}

export function markRead(notificationId: string): Promise<void> {
  return http.post(`/notifications/${notificationId}/read`).then(() => undefined);
}
