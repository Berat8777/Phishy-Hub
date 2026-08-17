import { useCallback, useEffect, useRef, useState } from 'react';
import * as messagesApi from '../api/endpoints/messages';
import { emitMessageSend } from '../socket/emit';
import { generateTempId } from '../utils/id';
import { useAuth } from '../auth/AuthContext';
import type { MessageDTO } from '../api/types';

export type ClientMessageStatus = 'sending' | 'sent' | 'failed';

export interface ClientMessage extends MessageDTO {
  status: ClientMessageStatus;
  tempId?: string;
}

/**
 * Per-channel message state for the chat screen — a scoped, single-channel
 * port of web/src/stores/messages.ts's upsert/dedupe discipline (that store
 * is a global normalized cache across every channel at once, since Pinia
 * state persists across screens; this app only ever has one chat screen
 * mounted at a time, so a plain per-screen hook is enough).
 *
 * Dedupe order is load-bearing, same as web: match `tempId` FIRST, then
 * fall back to `id` — the sender receives their own message back via the
 * `message:new` broadcast too (CONTRACT.md §4.3), so both the ack (from
 * `sendMessage` below) and the broadcast (via `receiveMessage`, wired by
 * the chat screen's socket listener) call `upsert` for the same message.
 */
export function useChannelMessages(channelId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Oldest-first internally (server returns newest-first, CONTRACT.md §2.2 — reversed on the way in).
  const messagesRef = useRef<ClientMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const upsert = useCallback((message: MessageDTO, tempId?: string) => {
    setMessages((prev) => {
      if (tempId) {
        const tempIdx = prev.findIndex((m) => m.id === tempId);
        if (tempIdx !== -1) {
          const next = [...prev];
          next.splice(tempIdx, 1);
          const existingIdx = next.findIndex((m) => m.id === message.id);
          if (existingIdx !== -1) {
            next[existingIdx] = { ...message, status: 'sent' };
          } else {
            next.push({ ...message, status: 'sent' });
          }
          return next;
        }
      }
      const existingIdx = prev.findIndex((m) => m.id === message.id);
      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = { ...prev[existingIdx], ...message, status: 'sent' };
        return next;
      }
      return [...prev, { ...message, status: 'sent' }];
    });
  }, []);

  const fetchInitial = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const { items, hasMore: more } = await messagesApi.listMessages(channelId, { limit: 30 });
      setHasMore(more);
      setMessages([...items].reverse().map((m) => ({ ...m, status: 'sent' as const })));
    } finally {
      setLoadingInitial(false);
    }
  }, [channelId]);

  const fetchOlder = useCallback(async () => {
    const oldest = messagesRef.current[0];
    if (!oldest || oldest.tempId) return; // nothing to page from yet, or the "oldest" row is still an optimistic send
    setLoadingOlder(true);
    try {
      const { items, hasMore: more } = await messagesApi.listMessages(channelId, { before: oldest.id, limit: 30 });
      setHasMore(more);
      const ascending = [...items].reverse().map((m) => ({ ...m, status: 'sent' as const }));
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        return [...ascending.filter((m) => !existingIds.has(m.id)), ...prev];
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [channelId]);

  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

  const sendMessage = useCallback(
    async (input: { body?: string; replyToMessageId?: string; fileIds?: string[] }) => {
      const tempId = generateTempId();
      const now = new Date().toISOString();
      const optimistic: ClientMessage = {
        id: tempId,
        channelId,
        senderId: user?.id ?? '',
        sender: user
          ? { id: user.id, firstName: user.firstName, lastName: user.lastName, avatarFileId: user.avatarFileId }
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
      setMessages((prev) => [...prev, optimistic]);

      try {
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
        upsert(message, tempId);
      } catch (err) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
        throw err;
      }
    },
    [channelId, user, upsert],
  );

  const receiveMessage = useCallback((message: MessageDTO, tempId?: string) => upsert(message, tempId), [upsert]);

  const applyMessageUpdated = useCallback((message: MessageDTO) => upsert(message), [upsert]);

  const applyMessageDeleted = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const discardFailed = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  return {
    messages,
    hasMore,
    loadingInitial,
    loadingOlder,
    fetchOlder,
    sendMessage,
    receiveMessage,
    applyMessageUpdated,
    applyMessageDeleted,
    discardFailed,
  };
}
