import { useToast } from '@phishyhub/design-system';
import { getSocket } from './connection';
import { useChannelsStore } from '../stores/channels';
import { useMessagesStore } from '../stores/messages';
import { useTypingStore } from '../stores/typing';
import { usePresenceStore } from '../stores/presence';
import { useNotificationsStore } from '../stores/notifications';
import { useAuthStore } from '../stores/auth';
import { useTicketsStore } from '../features/boards/stores/tickets';
import { useAiStore } from '../stores/ai';

/**
 * The one place server -> client socket events turn into Pinia store
 * mutations. Components must NEVER call `socket.on` directly — always go
 * through a store getter/action that this file keeps up to date instead.
 *
 * This is the one deliberate exception to the "src/socket/ never imports
 * vue/pinia" rule stated for connection.ts/emit.ts/events.ts: this file's
 * entire purpose (per its name) is bridging the framework-agnostic socket
 * transport into the Pinia stores, so it necessarily depends on both.
 * connection.ts/emit.ts/events.ts stay pure so they could still be lifted
 * into a non-Vue client (Electron main process, etc) later; this file could
 * not be, and isn't meant to be.
 *
 * `initEventBridge()` must be called exactly once, from main.ts.
 */
let initialized = false;

export function initEventBridge(): void {
  if (initialized) return;
  initialized = true;

  const socket = getSocket();

  socket.on('connect', () => {
    void resyncOnReconnect();
  });

  socket.on('message:new', ({ message, tempId }) => {
    const messagesStore = useMessagesStore();
    const channelsStore = useChannelsStore();
    const authStore = useAuthStore();
    messagesStore.receiveMessage(message, tempId);
    if (!message.replyToMessageId) {
      channelsStore.applyIncomingMessagePreview({
        channelId: message.channelId,
        message: { id: message.id, body: message.body, senderId: message.senderId, createdAt: message.createdAt },
        isOwnMessage: message.senderId === authStore.user?.id,
      });
    }
  });

  socket.on('message:updated', ({ message }) => {
    useMessagesStore().applyMessageUpdated(message);
  });

  socket.on('message:deleted', ({ messageId, channelId }) => {
    useMessagesStore().applyMessageDeleted(messageId, channelId);
  });

  socket.on('message:read', ({ channelId, userId, lastReadMessageId }) => {
    const authStore = useAuthStore();
    if (userId === authStore.user?.id) {
      useChannelsStore().applyReadReceipt(channelId, lastReadMessageId);
    }
  });

  socket.on('typing', ({ channelId, userId, isTyping }) => {
    useTypingStore().setTyping(channelId, userId, isTyping);
  });

  socket.on('presence:update', ({ userId, status, lastSeenAt }) => {
    usePresenceStore().setPresence(userId, status, lastSeenAt);
  });

  socket.on('notification:new', ({ notification }) => {
    useNotificationsStore().addNotification(notification);
    useToast().push({ title: 'New notification', description: notification.type, variant: 'default' });
  });

  socket.on('reaction:added', ({ messageId, emoji, userId }) => {
    useMessagesStore().applyReactionAdded(messageId, emoji, userId);
  });

  socket.on('reaction:removed', ({ messageId, emoji, userId }) => {
    useMessagesStore().applyReactionRemoved(messageId, emoji, userId);
  });

  socket.on('ticket:created', ({ ticket }) => {
    useTicketsStore().applyTicketUpserted(ticket);
  });

  socket.on('ticket:updated', ({ ticket }) => {
    useTicketsStore().applyTicketUpserted(ticket);
  });

  socket.on('ticket:deleted', ({ ticketId }) => {
    useTicketsStore().applyTicketDeleted(ticketId);
  });

  // AI RAG code assistant (Phase 6 / Module 7) — server-only events, see
  // socket/events.ts for payload shapes.
  socket.on('ai:answer:start', (payload) => {
    useAiStore().handleAnswerStart(payload);
  });

  socket.on('ai:answer:delta', (payload) => {
    useAiStore().handleAnswerDelta(payload);
  });

  socket.on('ai:answer:done', (payload) => {
    useAiStore().handleAnswerDone(payload);
  });

  socket.on('ai:answer:error', (payload) => {
    useAiStore().handleAnswerError(payload);
  });

  socket.on('ai:index:progress', (payload) => {
    useAiStore().handleIndexProgress(payload);
  });
}

/**
 * Runs on every `connect` event, including reconnects (not just the first
 * connect) — the server does not replay missed messages, so anything sent
 * while this client was disconnected is otherwise silently lost.
 */
async function resyncOnReconnect(): Promise<void> {
  const channelsStore = useChannelsStore();
  const messagesStore = useMessagesStore();
  const typingStore = useTypingStore();

  await channelsStore.fetchChannels();

  const activeId = channelsStore.activeChannelId;
  if (activeId) {
    await messagesStore.resyncChannel(activeId);
  }

  // Typing timers from before the disconnect are meaningless — the socket
  // that would have delivered their `typing:stop` is gone.
  typingStore.reset();
}
