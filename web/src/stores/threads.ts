import { defineStore } from 'pinia';
import { useMessagesStore } from './messages';
import type { MessageDTO } from '../api/types';

/**
 * Thin façade over `messages` store's parent-indexed reply state
 * (`idsByParent`/`hasMoreByParent`/`loadingByParent`). Reply message
 * entities live in the SAME `byId` map as top-level channel messages — that
 * single source of truth is what lets `ThreadPanel` reuse `MessageList` /
 * `MessageItem` unmodified, and what keeps edits/reactions/deletes on a
 * reply consistent no matter which view is currently showing it.
 *
 * Kept as its own store (rather than folding callers over to
 * `useMessagesStore()` directly) purely for call-site clarity — "the
 * replies of this thread" reads better than reaching into the messages
 * store's parent-keyed maps from every thread-related component.
 */
export const useThreadsStore = defineStore('threads', () => {
  function fetchReplies(parentMessageId: string, opts: { before?: string } = {}): Promise<void> {
    return useMessagesStore().fetchReplies(parentMessageId, opts);
  }

  function getReplies(parentMessageId: string) {
    return useMessagesStore().getReplies(parentMessageId);
  }

  function hasMore(parentMessageId: string): boolean {
    return useMessagesStore().hasMoreReplies(parentMessageId);
  }

  function isLoading(parentMessageId: string): boolean {
    return useMessagesStore().isLoadingReplies(parentMessageId);
  }

  function getRootMessage(parentMessageId: string): MessageDTO | undefined {
    return useMessagesStore().getMessage(parentMessageId);
  }

  function sendReply(parentMessageId: string, channelId: string, body: string): Promise<void> {
    return useMessagesStore().sendMessage(channelId, { body, replyToMessageId: parentMessageId });
  }

  /** No-op: entity/index state lives in `messages` store, which resets itself as part of the same logout sweep (stores/index.ts). */
  function reset(): void {
    // intentionally empty
  }

  return { fetchReplies, getReplies, hasMore, isLoading, getRootMessage, sendReply, reset };
});
