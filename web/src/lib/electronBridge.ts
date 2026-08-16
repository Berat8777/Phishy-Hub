import { watch } from 'vue';
import type { Router } from 'vue-router';
import { useChannelsStore } from '../stores/channels';
import { useNotificationsStore } from '../stores/notifications';
import { useSearchStore } from '../stores/search';
import type { NotificationDTO } from '../api/types';

/**
 * The renderer-side half of the desktop/ Electron wrapper's IPC bridge
 * (desktop/src/preload.ts exposes the matching `window.phishyHub` object via
 * `contextBridge`). Absent entirely in a plain browser tab — every call
 * below is guarded by `isElectron()` so this file is a no-op there.
 *
 * This is the one addition the desktop wrapper makes to `web/` itself (per
 * the wrapper's own instructions: everything else lives under `desktop/`).
 * It has to live here rather than purely in `desktop/` because native
 * notification click -> "navigate to the right screen" has to reuse the
 * app's own Vue Router + Pinia stores (SearchPanel.vue's
 * `searchStore.requestScrollTo` + `router.push` pattern), which only the
 * renderer has access to — the plan explicitly calls for routing to happen
 * here, not from the main process.
 */

export interface NotificationNavigateTarget {
  routeName: string;
  params?: Record<string, string>;
  /** Set when the notification points at a specific message (mirrors SearchPanel.vue's scroll-to-message hand-off). */
  scrollTo?: { channelId: string; messageId: string };
}

interface ShowNotificationOptions {
  title: string;
  body: string;
  navigate: NotificationNavigateTarget;
}

interface PhishyHubBridge {
  readonly isElectron: true;
  setUnreadCount(count: number): void;
  showNotification(options: ShowNotificationOptions): void;
  onNavigate(callback: (target: NotificationNavigateTarget) => void): () => void;
}

declare global {
  interface Window {
    /** Present only when running inside the desktop/ Electron shell. */
    phishyHub?: PhishyHubBridge;
  }
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.phishyHub);
}

/**
 * Maps a notification's `type`/`payload` (CONTRACT.md §3.11) to a route.
 * Payload shapes today (api/src/services/*.service.ts::createNotification
 * call sites): `ticket_assigned`/`ticket_comment_added` carry `ticketId`,
 * `meeting_invite` carries `meetingId`, `leave_request_submitted`/
 * `leave_request_reviewed` carry `leaveRequestId`. None of the current
 * notification types carry a `channelId`/`messageId` (chat mentions/DMs
 * don't emit a NotificationDTO at all yet — new messages arrive purely via
 * the `message:new` socket event + a toast). The `channelId`/`messageId`
 * branch below is kept anyway so this stays correct the day a chat-mention
 * notification type is added, without another Electron-side change.
 */
function routeForNotification(notification: NotificationDTO): NotificationNavigateTarget {
  const payload = notification.payload;
  const channelId = typeof payload.channelId === 'string' ? payload.channelId : undefined;
  const messageId = typeof payload.messageId === 'string' ? payload.messageId : undefined;
  if (channelId) {
    return {
      routeName: 'chat',
      params: { channelId },
      scrollTo: messageId ? { channelId, messageId } : undefined,
    };
  }

  const ticketId = typeof payload.ticketId === 'string' ? payload.ticketId : undefined;
  if (ticketId) {
    return { routeName: 'boards-ticket', params: { ticketId } };
  }

  if (typeof payload.meetingId === 'string') {
    return { routeName: 'hr-calendar' };
  }

  if (typeof payload.leaveRequestId === 'string') {
    // `leave_request_submitted` notifies the approver (manager/HR) -> the
    // approvals queue; `leave_request_reviewed` notifies the requester
    // about their own request -> their leave request list.
    return { routeName: notification.type === 'leave_request_submitted' ? 'hr-approvals' : 'hr' };
  }

  return { routeName: 'chat' };
}

function titleForNotification(notification: NotificationDTO): string {
  switch (notification.type) {
    case 'ticket_assigned':
      return 'Ticket assigned to you';
    case 'ticket_comment_added':
      return 'New comment on your ticket';
    case 'meeting_invite':
      return 'Meeting invite';
    case 'leave_request_submitted':
      return 'Leave request needs review';
    case 'leave_request_reviewed':
      return 'Leave request reviewed';
    default:
      return 'New notification';
  }
}

function bodyForNotification(notification: NotificationDTO): string {
  const payload = notification.payload;
  if (typeof payload.title === 'string') return payload.title;
  if (typeof payload.status === 'string') return `Status: ${payload.status}`;
  return '';
}

/**
 * Wires the Electron bridge up to the app's existing stores. No-ops
 * entirely outside Electron. Call once from `main.ts`, after Pinia + the
 * router are installed (same call-site convention as `initEventBridge()`).
 */
export function initElectronIntegration(router: Router): void {
  const bridge = window.phishyHub;
  if (!bridge) return;

  const channelsStore = useChannelsStore();
  const notificationsStore = useNotificationsStore();
  const searchStore = useSearchStore();

  watch(
    () => channelsStore.totalUnreadCount,
    (count) => bridge.setUnreadCount(count),
    { immediate: true },
  );

  // Only reacts to a genuine single new arrival (`addNotification`, pushed
  // one at a time by socket/eventBridge.ts's `notification:new` handler) —
  // not the bulk replace `fetchNotifications()` does when e.g.
  // hr/stores/leave.ts's approvals-queue discoverability path loads a whole
  // notification backlog, which must never fire a flood of OS notifications
  // for old items.
  let seenIds = new Set(notificationsStore.items.map((n) => n.id));
  watch(
    () => notificationsStore.items,
    (items) => {
      const newOnes = items.filter((n) => !seenIds.has(n.id));
      seenIds = new Set(items.map((n) => n.id));
      if (newOnes.length !== 1) return;
      if (document.hasFocus()) return;
      const notification = newOnes[0];
      bridge.showNotification({
        title: titleForNotification(notification),
        body: bodyForNotification(notification),
        navigate: routeForNotification(notification),
      });
    },
  );

  bridge.onNavigate((target) => {
    if (target.scrollTo) {
      searchStore.requestScrollTo(target.scrollTo.channelId, target.scrollTo.messageId);
    }
    void router.push({ name: target.routeName, params: target.params });
  });
}
