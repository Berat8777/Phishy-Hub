import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as aiApi from '../api/endpoints/ai';
import type { AiQueryResponse } from '../api/endpoints/ai';
import type {
  AiAnswerDeltaEvent,
  AiAnswerDoneEvent,
  AiAnswerErrorEvent,
  AiAnswerStartEvent,
  AiIndexProgressEvent,
} from '../socket/events';
import type { AiCitation, AiIndexRunDTO, AiQueryDTO, AiStatusDTO, PaginationMeta } from '../api/types';

/**
 * AI RAG code assistant (Phase 6 / Module 7). Simpler than
 * `stores/messages.ts`'s incremental-update logic — every buffer here is
 * keyed by `queryId` (or `messageId` for the chat-integration case) and just
 * accumulates `delta` text in arrival order; there's no dedup/reconciliation
 * concern like message.ts's tempId-vs-broadcast matching, since a query only
 * ever has one in-flight answer stream.
 */
export const useAiStore = defineStore('ai', () => {
  const status = ref<AiStatusDTO | null>(null);
  const history = ref<AiQueryDTO[]>([]);
  const historyMeta = ref<PaginationMeta | null>(null);
  const historyLoading = ref(false);

  /** Accumulating answer-buffer per `queryId` — the Ask view binds to this while a query is streaming. */
  const streamingByQueryId = ref<Record<string, string>>({});
  /** Same buffer, but keyed by the chat message id being streamed into (only set for `@ai`-mention-triggered queries) — MessageItem.vue reads this to render live text instead of the message's static `body`. */
  const streamingByMessageId = ref<Record<string, string>>({});
  const citationsByQueryId = ref<Record<string, AiCitation[]>>({});
  /** Set on `ai:answer:error`; cleared on the next `ask()`/answer-start for that query. */
  const errorByQueryId = ref<Record<string, { code: string; message: string }>>({});
  /**
   * `true` while a query is still streaming (from `ask()`'s response through
   * `ai:answer:done`/`error`) — not part of the state list requested for
   * this store, but needed by AiAssistantView.vue to know when to show the
   * blinking-caret affordance vs. a settled answer, since `streamingByQueryId`
   * alone can't distinguish "still streaming" from "done, holding final text".
   */
  const activeQueryIds = ref<Record<string, boolean>>({});
  /** Live progress from `ai:index:progress` — the admin "AI Index" card renders this while a run is active, distinct from the (non-live) `status.activeRun` snapshot. */
  const indexProgress = ref<AiIndexProgressEvent | null>(null);

  // Not reactive state on purpose — internal bookkeeping only, to route
  // `ai:answer:delta`/`done`/`error` (keyed by queryId, per CONTRACT-given
  // socket payloads) into the right `streamingByMessageId` entry too, for
  // whichever queries were started with a `messageId` (CONTRACT §"@ai bot").
  const messageIdByQueryId = new Map<string, string>();

  async function fetchStatus(): Promise<void> {
    status.value = await aiApi.getStatus();
  }

  /**
   * `POST /ai/query`. Seeds the streaming buffer(s) immediately so the UI has
   * somewhere to render into as soon as `ai:answer:start` (or the very first
   * delta) arrives; the socket handlers below do the rest for a streamed
   * answer. For `stream: false`, the full answer is already in the response,
   * so it's written straight into `streamingByQueryId` too — Ask view code
   * doesn't need to special-case either path.
   */
  async function ask(
    question: string,
    opts: { channelId?: string; parentQueryId?: string; stream?: boolean } = {},
  ): Promise<AiQueryResponse> {
    const res = await aiApi.query({
      question,
      channelId: opts.channelId,
      parentQueryId: opts.parentQueryId,
      stream: opts.stream,
    });
    delete errorByQueryId.value[res.queryId];
    citationsByQueryId.value[res.queryId] = res.citations;
    streamingByQueryId.value[res.queryId] = res.answer ?? '';
    // `res.answer === undefined` means this is the streaming path (default
    // `stream: true`) — the answer isn't final yet, mark it active even
    // though `ai:answer:start` may not have arrived over the socket yet.
    if (res.answer === undefined) activeQueryIds.value[res.queryId] = true;
    return res;
  }

  function search(q: string, limit?: number) {
    return aiApi.search({ q, limit });
  }

  /** Admin only (server-enforced) — kicks off a reindex and folds the new run into `status.activeRun` so the admin card updates without a full `fetchStatus()` round-trip. */
  async function triggerReindex(): Promise<AiIndexRunDTO> {
    const run = await aiApi.triggerIndex();
    if (status.value) status.value = { ...status.value, activeRun: run };
    indexProgress.value = null;
    return run;
  }

  /** `GET /ai/queries` — own queries; admin may pass `userId` to inspect another user's history. */
  async function fetchHistory(params: { userId?: string; page?: number; pageSize?: number } = {}): Promise<void> {
    historyLoading.value = true;
    try {
      const { items, meta } = await aiApi.listQueries(params);
      history.value = items;
      historyMeta.value = meta;
      for (const q of items) {
        citationsByQueryId.value[q.id] = q.citations;
      }
    } finally {
      historyLoading.value = false;
    }
  }

  /** `GET /ai/queries/:id` — used when clicking a history row to show its stored answer/citations. */
  async function fetchQuery(queryId: string): Promise<AiQueryDTO> {
    const q = await aiApi.getQuery(queryId);
    citationsByQueryId.value[q.id] = q.citations;
    if (q.answer !== null) streamingByQueryId.value[q.id] = q.answer;
    return q;
  }

  // --- Socket handlers (eventBridge.ts is the ONLY caller of these) ---

  function handleAnswerStart(payload: AiAnswerStartEvent): void {
    delete errorByQueryId.value[payload.queryId];
    activeQueryIds.value[payload.queryId] = true;
    streamingByQueryId.value[payload.queryId] = '';
    citationsByQueryId.value[payload.queryId] = payload.citations;
    if (payload.messageId) {
      messageIdByQueryId.set(payload.queryId, payload.messageId);
      streamingByMessageId.value[payload.messageId] = '';
    }
  }

  function handleAnswerDelta(payload: AiAnswerDeltaEvent): void {
    const current = streamingByQueryId.value[payload.queryId] ?? '';
    streamingByQueryId.value[payload.queryId] = current + payload.delta;

    const messageId = messageIdByQueryId.get(payload.queryId);
    if (messageId) {
      const currentByMessage = streamingByMessageId.value[messageId] ?? '';
      streamingByMessageId.value[messageId] = currentByMessage + payload.delta;
    }
  }

  /**
   * Final answer. `streamingByQueryId` is left holding the full text (the
   * Ask view keeps rendering the same reactive field whether streaming just
   * finished or `stream:false` returned it outright). `streamingByMessageId`
   * is cleared instead — MessageItem.vue falls back to the message's own
   * (by-now-finalized) `body` per the task brief.
   */
  function handleAnswerDone(payload: AiAnswerDoneEvent): void {
    streamingByQueryId.value[payload.queryId] = payload.answer;
    citationsByQueryId.value[payload.queryId] = payload.citations;
    delete activeQueryIds.value[payload.queryId];

    const messageId = payload.messageId ?? messageIdByQueryId.get(payload.queryId);
    if (messageId) {
      delete streamingByMessageId.value[messageId];
    }
    messageIdByQueryId.delete(payload.queryId);
  }

  function handleAnswerError(payload: AiAnswerErrorEvent): void {
    errorByQueryId.value[payload.queryId] = { code: payload.code, message: payload.message };
    delete activeQueryIds.value[payload.queryId];

    const messageId = messageIdByQueryId.get(payload.queryId);
    if (messageId) {
      delete streamingByMessageId.value[messageId];
    }
    messageIdByQueryId.delete(payload.queryId);
  }

  /**
   * Called from eventBridge.ts's `resyncOnReconnect()` — a query left in
   * `activeQueryIds` when the socket drops (server restart, network blip,
   * laptop sleep) never gets its `ai:answer:done`/`error` event and is
   * otherwise stuck showing a spinner forever, even though the backend may
   * have finished (or failed) it seconds after the disconnect. Re-fetches
   * each still-active query's real persisted state and reconciles.
   */
  async function reconcileActiveQueries(): Promise<void> {
    const ids = Object.keys(activeQueryIds.value);
    if (ids.length === 0) return;
    await Promise.all(
      ids.map(async (queryId) => {
        try {
          const q = await fetchQuery(queryId);
          if (q.status === 'succeeded') {
            handleAnswerDone({
              queryId,
              answer: q.answer ?? '',
              citations: q.citations,
              messageId: messageIdByQueryId.get(queryId),
            });
          } else if (q.status === 'failed') {
            handleAnswerError({
              queryId,
              code: q.errorCode ?? 'AI_UPSTREAM_ERROR',
              message: 'The connection was lost before this answer finished.',
            });
          }
          // Still 'pending'/'streaming' server-side: leave it active — a
          // socket event or the next reconnect will resolve it.
        } catch {
          // Couldn't verify (e.g. offline) — leave it active rather than
          // guessing; a stuck spinner is a better failure mode than a false
          // error on a query that actually succeeded.
        }
      }),
    );
  }

  function handleIndexProgress(payload: AiIndexProgressEvent): void {
    indexProgress.value = payload;
    if (status.value?.activeRun && status.value.activeRun.id === payload.runId) {
      status.value = {
        ...status.value,
        activeRun: { ...status.value.activeRun, status: payload.status, chunkCount: payload.chunkCount },
      };
    }
  }

  function reset(): void {
    status.value = null;
    history.value = [];
    historyMeta.value = null;
    historyLoading.value = false;
    streamingByQueryId.value = {};
    streamingByMessageId.value = {};
    citationsByQueryId.value = {};
    errorByQueryId.value = {};
    activeQueryIds.value = {};
    indexProgress.value = null;
    messageIdByQueryId.clear();
  }

  return {
    status,
    history,
    historyMeta,
    historyLoading,
    streamingByQueryId,
    streamingByMessageId,
    citationsByQueryId,
    errorByQueryId,
    activeQueryIds,
    indexProgress,
    fetchStatus,
    ask,
    search,
    triggerReindex,
    fetchHistory,
    fetchQuery,
    reconcileActiveQueries,
    handleAnswerStart,
    handleAnswerDelta,
    handleAnswerDone,
    handleAnswerError,
    handleIndexProgress,
    reset,
  };
});
