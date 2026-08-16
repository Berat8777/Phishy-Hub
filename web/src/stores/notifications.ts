import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import * as notificationsApi from '../api/endpoints/notifications';
import type { NotificationDTO } from '../api/types';

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationDTO[]>([]);
  const loaded = ref(false);

  const unreadCount = computed(() => items.value.filter((n) => !n.isRead).length);

  async function fetchNotifications(): Promise<void> {
    items.value = await notificationsApi.listNotifications();
    loaded.value = true;
  }

  /** `notification:new` from the socket. */
  function addNotification(notification: NotificationDTO): void {
    items.value = [notification, ...items.value];
  }

  async function markRead(notificationId: string): Promise<void> {
    await notificationsApi.markRead(notificationId);
    const target = items.value.find((n) => n.id === notificationId);
    if (target) target.isRead = true;
  }

  async function markAllRead(): Promise<void> {
    await notificationsApi.markAllRead();
    items.value = items.value.map((n) => ({ ...n, isRead: true }));
  }

  function reset(): void {
    items.value = [];
    loaded.value = false;
  }

  return { items, loaded, unreadCount, fetchNotifications, addNotification, markRead, markAllRead, reset };
});
