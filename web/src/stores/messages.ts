import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as messagesApi from '../api/endpoints/messages';
import { emitMessageSend } from '../socket/emit';
import { useAuthStore } from './auth';
import type { MessageDTO } from '../api/types';

export type ClientMessageStatus = 'sending' | 'sent' | 'failed';

export interface ClientMessage extends MessageDTO {
  status: ClientMessageStatus;
  /** Present only while the message is still keyed by its optimistic id. */
  tempId?: string;
}

export const useMessagesStore = defineStore('messages', () => {
  // Normalized store: message entities by id, plus per-channel AND
  // per-thread-parent ordered id lists (oldest -> newest) so components can
  // render in a stable order without re-sorting on every mutation.
  //
  // `idsByChannel` holds ONLY top-level messages (replyToMessageId == null)
  // — this mirrors the server's own split (CONTRACT.md §3.6: the main
  // channel timeline excludes thread replies, they only live under
  // GET /messages/:id/replies). `idsByParent` holds thread replies, keyed by
  // their `replyToMessageId`. Every message (whichever list it ends up in)
  // is still stored once in `byId` — this is what lets ThreadPanel reuse the
  // exact same MessageList/MessageItem components and status/reaction logic
  // as the main channel view instead of forking a parallel implementation.
  const byId = ref<Map<string, ClientMessage>>(new Map());
  const idsByChannel = ref<Map<string, string[]>>(new Map());
  const hasMoreByChannel = ref<Map<string, boolean>>(new Map());
  const loadingByChannel = ref<Map<string, boolean>>(new Map());
  const idsByParent = ref<Map<string, string[]>>(new Map());
  const hasMoreByParent = ref<Map<string, boolean>>(new Map());
  const loadingByParent = ref<Map<string, boolean>>(new Map());

  function getMessages(channelId: string): ClientMessage[] {
    const ids = idsByChannel.value.get(channelId) ?? [];
    const out: ClientMessage[] = [];
    for (const id of ids) {
      const message = byId.value.get(id);
      if (message) out.push(message);
    }
    return out;
  }

  function hasMore(channelId: string): boolean {
    return hasMoreByChannel.value.get(channelId) ?? false;
  }

  function isLoading(channelId: string): boolean {
    return loadingByChannel.value.get(channelId) ?? false;
  }

  function newestMessageId(channelId: string): string | null {
    const ids = idsByChannel.value.get(channelId);
    if (!ids || ids.length === 0) return null;
    return ids[ids.length - 1] ?? null;
  }

  function getReplies(parentMessageId: string): ClientMessage[] {
    const ids = idsByParent.value.get(parentMessageId) ?? [];
    const out: ClientMessage[] = [];
    for (const id of ids) {
      const message = byId.value.get(id);
      if (message) out.push(message);
    }
    return out;
  }

  function hasMoreReplies(parentMessageId: string): boolean {
    return hasMoreByParent.value.get(parentMessageId) ?? false;
  }

  function isLoadingReplies(parentMessageId: string): boolean {
    return loadingByParent.value.get(parentMessageId) ?? false;
  }

  function getMessage(messageId: string): ClientMessage | undefined {
    return byId.value.get(messageId);
  }

  /**
   * The single merge point for every message arriving from any source (REST
   * fetch, socket `message:new`, the `message:send` ack). Dedupe order is
   * load-bearing: match `tempId` FIRST, THEN fall back to `id`. The sender
   * receives their own message back via the `message:new` broadcast too
   * (CONTRACT.md §4.3 — the server doesn't exclude the sender's socket from
   * the room), so both the ack and the broadcast call this for the same
   * message; matching tempId first collapses them into the one optimistic
   * row instead of leaving a duplicate.
   *
   * Routes into `idsByChannel` or `idsByParent` based on
   * `message.replyToMessageId` — this is what keeps thread replies out of
   * the main channel timeline (and out of any OTHER thread's list) no
   * matter which of the three arrival paths produced them.
   */
  function upsertMessage(message: MessageDTO, tempId?: string): void {
    const isReply = Boolean(message.replyToMessageId);
    const indexMap = isReply ? idsByParent : idsByChannel;
    const indexKey = isReply ? (message.replyToMessageId as string) : message.channelId;
    const list = indexMap.value.get(indexKey) ?? [];

    if (tempId && byId.value.has(tempId)) {
      const idx = list.indexOf(tempId);
      if (idx !== -1) {
        list[idx] = message.id;
      } else if (!list.includes(message.id)) {
        list.push(message.id);
      }
      byId.value.delete(tempId);
      byId.value.set(message.id, { ...message, status: 'sent' });
      indexMap.value.set(indexKey, list);
      return;
    }

    const existing = byId.value.get(message.id);
    if (existing) {
      byId.value.set(message.id, { ...existing, ...message, status: 'sent' });
      return;
    }

    byId.value.set(message.id, { ...message, status: 'sent' });
    if (!list.includes(message.id)) {
      list.push(message.id);
      indexMap.value.set(indexKey, list);
    }

    // A brand-new reply from someone else (not our own optimistic send,
    // which bumps this itself in sendMessage below) — keep the parent's
    // reply summary fresh if the parent happens to be cached.
    if (isReply) {
      const parent = byId.value.get(message.replyToMessageId as string);
      if (parent) {
        byId.value.set(parent.id, {
          ...parent,
          replyCount: parent.replyCount + 1,
          lastReplyAt: message.createdAt,
        });
      }
    }
  }

  function prependMessages(channelId: string, messages: MessageDTO[]): void {
    const list = idsByChannel.value.get(channelId) ?? [];
    const newIds: string[] = [];
    for (const message of messages) {
      byId.value.set(message.id, { ...message, status: 'sent' });
      if (!list.includes(message.id)) newIds.push(message.id);
    }
    idsByChannel.value.set(channelId, [...newIds, ...list]);
  }

  function prependReplies(parentMessageId: string, messages: MessageDTO[]): void {
    const list = idsByParent.value.get(parentMessageId) ?? [];
    const newIds: string[] = [];
    for (const message of messages) {
      byId.value.set(message.id, { ...message, status: 'sent' });
      if (!list.includes(message.id)) newIds.push(message.id);
    }
    idsByParent.value.set(parentMessageId, [...newIds, ...list]);
  }

  /**
   * `before` omitted -> first page (newest N). `before` set -> older page,
   * prepended to the front of the channel's list instead of appended.
   * The server returns newest-first (`createdAt DESC, id DESC`,
   * CONTRACT.md §2.2); this store keeps oldest-first internally, so pages
   * are reversed on the way in.
   */
  async function fetchMessages(channelId: string, opts: { before?: string; limit?: number } = {}): Promise<void> {
    loadingByChannel.value.set(channelId, true);
    try {
      const { items, hasMore: more } = await messagesApi.listMessages(channelId, {
        before: opts.before,
        limit: opts.limit,
      });
      hasMoreByChannel.value.set(channelId, more);
      const ascending = [...items].reverse();
      if (opts.before) {
        prependMessages(channelId, ascending);
      } else {
        for (const message of ascending) upsertMessage(message);
      }
    } finally {
      loadingByChannel.value.set(channelId, false);
    }
  }

  /** Same cursor-pagination shape as fetchMessages, scoped to a thread's replies (CONTRACT.md §3.6). */
  async function fetchReplies(parentMessageId: string, opts: { before?: string; limit?: number } = {}): Promise<void> {
    loadingByParent.value.set(parentMessageId, true);
    try {
      const { items, hasMore: more } = await messagesApi.listReplies(parentMessageId, {
        before: opts.before,
        limit: opts.limit,
      });
      hasMoreByParent.value.set(parentMessageId, more);
      const ascending = [...items].reverse();
      if (opts.before) {
        prependReplies(parentMessageId, ascending);
      } else {
        for (const message of ascending) upsertMessage(message);
      }
    } finally {
      loadingByParent.value.set(parentMessageId, false);
    }
  }

  /**
   * Best-effort resync fetch used after a reconnect (socket/eventBridge.ts).
   * The REST API only exposes a `before` (older-than) cursor, not an
   * `after` one, so "messages newer than the newest cached id" is
   * approximated by refetching the latest page and merging by id — exact
   * for any gap shorter than the page size, lossy beyond that. Flagged as a
   * known limitation, not silently swallowed.
   */
  async function resyncChannel(channelId: string): Promise<void> {
    const { items } = await messagesApi.listMessages(channelId, { limit: 50 });
    for (const message of [...items].reverse()) upsertMessage(message);
  }

  /**
   * Optimistic send: insert immediately with status 'sending', reconcile on
   * ack/broadcast via upsertMessage's tempId-first dedupe. Used for BOTH
   * top-level channel sends and thread replies (pass `replyToMessageId`) —
   * the single source of tempId generation for the whole app, per the task
   * brief ("generate the tempId in the store action, not scattered in the
   * component").
   *
   * `fileIds` (attachments) routes through the REST endpoint instead of the
   * `message:send` socket emit — CONTRACT.md §4.2's socket payload has no
   * `fileIds` field, only the REST body does. `tempId` is sent on BOTH
   * paths now (CONTRACT.md §3.6/§4.2) so the `message:new` broadcast always
   * carries it regardless of which path produced it, and this function's
   * own `upsertMessage(message, tempId)` call below and the broadcast
   * arriving via `receiveMessage` both reconcile against the exact same
   * real tempId — no client-side guessing which pending send a broadcast
   * belongs to (that guess was the previous version of this fix, and broke
   * down the moment the same user had two clients sending into the same
   * channel at once; see git history for `pendingRestSends` if curious).
   */
  async function sendMessage(
    channelId: string,
    input: { body?: string; replyToMessageId?: string; fileIds?: string[] },
  ): Promise<void> {
    const authStore = useAuthStore();
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    const isReply = Boolean(input.replyToMessageId);

    const optimistic: ClientMessage = {
      id: tempId,
      channelId,
      senderId: authStore.user?.id ?? '',
      sender: authStore.user
        ? {
            id: authStore.user.id,
            firstName: authStore.user.firstName,
            lastName: authStore.user.lastName,
            avatarFileId: authStore.user.avatarFileId,
            isBot: authStore.user.isBot,
          }
        : null,
      body: input.body ?? null,
      type: 'text',
      replyToMessageId: input.replyToMessageId ?? null,
      editedAt: null,
      attachments: [],
      reactions: [],
      replyCount: 0,
      lastReplyAt: null,
      createdAt: now,
      updatedAt: now,
      status: 'sending',
      tempId,
    };

    byId.value.set(tempId, optimistic);
    if (isReply) {
      const list = idsByParent.value.get(input.replyToMessageId as string) ?? [];
      list.push(tempId);
      idsByParent.value.set(input.replyToMessageId as string, list);
      const parent = byId.value.get(input.replyToMessageId as string);
      if (parent) {
        byId.value.set(parent.id, { ...parent, replyCount: parent.replyCount + 1, lastReplyAt: now });
      }
    } else {
      const list = idsByChannel.value.get(channelId) ?? [];
      list.push(tempId);
      idsByChannel.value.set(channelId, list);
    }

    try {
      // Both paths pass `tempId` through to the server now (REST:
      // createMessageValidator + message.controller.ts's `create`; socket:
      // message.handler.ts's `message:send`), so EITHER path's
      // `message:new` broadcast — REST or socket-originated — always
      // carries the real tempId and reconciles via the exact match in
      // `upsertMessage` below, not a guess. That's what makes this safe
      // even with two of the sender's own clients (tabs/devices) both
      // sending file-attached messages into the same channel around the
      // same time: each broadcast only ever matches ITS OWN sender's
      // tempId, never the other client's.
      const message =
        input.fileIds && input.fileIds.length > 0
          ? await messagesApi.sendMessage(channelId, {
              body: input.body,
              replyToMessageId: input.replyToMessageId,
              fileIds: input.fileIds,
              tempId,
            })
          : await emitMessageSend({
              channelId,
              body: input.body,
              replyToMessageId: input.replyToMessageId,
              tempId,
            });
      upsertMessage(message, tempId);
    } catch (err) {
      const optimisticMessage = byId.value.get(tempId);
      if (optimisticMessage) byId.value.set(tempId, { ...optimisticMessage, status: 'failed' });
      throw err;
    }
  }

  /** REST `PATCH /messages/:id` (CONTRACT.md §3.6) — sender-or-admin, enforced server-side too. */
  async function editMessage(messageId: string, body: string): Promise<void> {
    const message = await messagesApi.updateMessage(messageId, body);
    applyMessageUpdated(message);
  }

  /** REST `DELETE /messages/:id`. `channelId` is needed for top-level removal bookkeeping (see applyMessageDeleted). */
  async function removeMessage(messageId: string, channelId: string): Promise<void> {
    await messagesApi.deleteMessage(messageId);
    applyMessageDeleted(messageId, channelId);
  }

  /**
   * REST reaction toggle (`PUT`/`DELETE /messages/:id/reactions`,
   * CONTRACT.md §3.6). Applies the fresh server DTO immediately (accurate
   * `reactedByMe` since this is a REST call, not a broadcast) — the
   * `reaction:added`/`removed` socket event that also arrives right after is
   * a safe no-op against the same state (applyReactionAdded/Removed below
   * are idempotent per-userId).
   */
  async function toggleReaction(messageId: string, emoji: string, currentlyReactedByMe: boolean): Promise<void> {
    const message = currentlyReactedByMe
      ? await messagesApi.removeReaction(messageId, emoji)
      : await messagesApi.addReaction(messageId, emoji);
    applyMessageUpdated(message);
  }

  /** `message:new` from the socket (eventBridge.ts). */
  function receiveMessage(message: MessageDTO, tempId?: string): void {
    upsertMessage(message, tempId);
  }

  /** `message:updated` from the socket. */
  function applyMessageUpdated(message: MessageDTO): void {
    const existing = byId.value.get(message.id);
    byId.value.set(message.id, { ...existing, ...message, status: 'sent' });
  }

  /**
   * `message:deleted` from the socket — server only sends
   * `{messageId, channelId}`, not a tombstone DTO, so we drop it locally.
   * The payload doesn't say whether the deleted message was a thread reply,
   * so this looks the removed entity up in `byId` first (before deleting)
   * to decide whether to also clean up `idsByParent`.
   */
  function applyMessageDeleted(messageId: string, channelId: string): void {
    const existing = byId.value.get(messageId);
    byId.value.delete(messageId);

    if (existing?.replyToMessageId) {
      const list = idsByParent.value.get(existing.replyToMessageId);
      if (list) {
        const idx = list.indexOf(messageId);
        if (idx !== -1) list.splice(idx, 1);
      }
      return;
    }

    const list = idsByChannel.value.get(channelId);
    if (!list) return;
    const idx = list.indexOf(messageId);
    if (idx !== -1) list.splice(idx, 1);
  }

  function applyReactionAdded(messageId: string, emoji: string, userId: string): void {
    const message = byId.value.get(messageId);
    if (!message) return;
    const reactions = message.reactions.map((r) => ({ ...r, userIds: [...r.userIds] }));
    const group = reactions.find((r) => r.emoji === emoji);
    if (group) {
      if (!group.userIds.includes(userId)) {
        group.userIds.push(userId);
        group.count = group.userIds.length;
      }
    } else {
      reactions.push({ emoji, count: 1, userIds: [userId], reactedByMe: false });
    }
    byId.value.set(messageId, { ...message, reactions });
  }

  function applyReactionRemoved(messageId: string, emoji: string, userId: string): void {
    const message = byId.value.get(messageId);
    if (!message) return;
    const reactions = message.reactions
      .map((r) => (r.emoji === emoji ? { ...r, userIds: r.userIds.filter((id) => id !== userId) } : r))
      .map((r) => ({ ...r, count: r.userIds.length }))
      .filter((r) => r.userIds.length > 0);
    byId.value.set(messageId, { ...message, reactions });
  }

  /** Drops a still-`failed` optimistic row entirely — used by the composer's retry affordance right before it re-sends with a fresh tempId. */
  function discardFailed(messageId: string): void {
    const message = byId.value.get(messageId);
    if (!message || message.status !== 'failed') return;
    byId.value.delete(messageId);
    const indexMap = message.replyToMessageId ? idsByParent : idsByChannel;
    const indexKey = message.replyToMessageId ?? message.channelId;
    const list = indexMap.value.get(indexKey);
    if (!list) return;
    const idx = list.indexOf(messageId);
    if (idx !== -1) list.splice(idx, 1);
  }

  function reset(): void {
    byId.value = new Map();
    idsByChannel.value = new Map();
    hasMoreByChannel.value = new Map();
    loadingByChannel.value = new Map();
    idsByParent.value = new Map();
    hasMoreByParent.value = new Map();
    loadingByParent.value = new Map();
  }

  return {
    byId,
    idsByChannel,
    getMessages,
    hasMore,
    isLoading,
    newestMessageId,
    getReplies,
    hasMoreReplies,
    isLoadingReplies,
    getMessage,
    fetchMessages,
    fetchReplies,
    resyncChannel,
    sendMessage,
    editMessage,
    removeMessage,
    toggleReaction,
    discardFailed,
    receiveMessage,
    applyMessageUpdated,
    applyMessageDeleted,
    applyReactionAdded,
    applyReactionRemoved,
    reset,
  };
});
