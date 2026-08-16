import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as ticketCommentsApi from '../../../api/endpoints/ticketComments';
import type { TicketCommentDTO } from '../../../api/types';

/**
 * Comment threads keyed by `ticketId`, mirroring how `stores/threads.ts` is
 * kept separate from `stores/messages.ts` — a distinct store for call-site
 * clarity even though it's a thin normalized cache like the others. No
 * socket events exist for ticket comments (CONTRACT.md §4.3 has no
 * `ticket:comment:*` entry), so this store has no applier for
 * eventBridge.ts to call — comments only ever change via this store's own
 * REST actions.
 */
export const useTicketCommentsStore = defineStore('ticketComments', () => {
  const byId = ref<Map<string, TicketCommentDTO>>(new Map());
  const idsByTicket = ref<Map<string, string[]>>(new Map());
  const totalByTicket = ref<Map<string, number>>(new Map());
  const loadingByTicket = ref<Map<string, boolean>>(new Map());

  function getComments(ticketId: string): TicketCommentDTO[] {
    const ids = idsByTicket.value.get(ticketId) ?? [];
    const out: TicketCommentDTO[] = [];
    for (const id of ids) {
      const comment = byId.value.get(id);
      if (comment) out.push(comment);
    }
    return out;
  }

  function getTotal(ticketId: string): number {
    return totalByTicket.value.get(ticketId) ?? getComments(ticketId).length;
  }

  function isLoading(ticketId: string): boolean {
    return loadingByTicket.value.get(ticketId) ?? false;
  }

  function upsertComment(ticketId: string, comment: TicketCommentDTO): void {
    byId.value.set(comment.id, comment);
    const ids = idsByTicket.value.get(ticketId) ?? [];
    if (!ids.includes(comment.id)) {
      idsByTicket.value.set(ticketId, [...ids, comment.id]);
      totalByTicket.value.set(ticketId, (totalByTicket.value.get(ticketId) ?? 0) + 1);
    } else {
      idsByTicket.value.set(ticketId, [...ids]);
    }
  }

  /** `GET /tickets/:id/comments` (CONTRACT.md §3.9, offset pagination) — fetched in one page (pageSize 100), same "comment threads are small" assumption `ThreadPanel` doesn't need for the much larger chat message history. */
  async function fetchComments(ticketId: string): Promise<void> {
    loadingByTicket.value.set(ticketId, true);
    try {
      const { items, meta } = await ticketCommentsApi.listComments(ticketId, { pageSize: 100 });
      for (const comment of items) byId.value.set(comment.id, comment);
      idsByTicket.value.set(ticketId, items.map((c) => c.id));
      totalByTicket.value.set(ticketId, meta.total);
    } finally {
      loadingByTicket.value.set(ticketId, false);
    }
  }

  async function addComment(ticketId: string, body: string): Promise<TicketCommentDTO> {
    const comment = await ticketCommentsApi.createComment(ticketId, body);
    upsertComment(ticketId, comment);
    return comment;
  }

  async function editComment(ticketId: string, commentId: string, body: string): Promise<void> {
    const comment = await ticketCommentsApi.updateComment(ticketId, commentId, body);
    upsertComment(ticketId, comment);
  }

  async function removeComment(ticketId: string, commentId: string): Promise<void> {
    await ticketCommentsApi.deleteComment(ticketId, commentId);
    byId.value.delete(commentId);
    const ids = idsByTicket.value.get(ticketId);
    if (ids) {
      const idx = ids.indexOf(commentId);
      if (idx !== -1) {
        const next = [...ids];
        next.splice(idx, 1);
        idsByTicket.value.set(ticketId, next);
      }
    }
    totalByTicket.value.set(ticketId, Math.max(0, (totalByTicket.value.get(ticketId) ?? 1) - 1));
  }

  function reset(): void {
    byId.value = new Map();
    idsByTicket.value = new Map();
    totalByTicket.value = new Map();
    loadingByTicket.value = new Map();
  }

  return {
    byId,
    getComments,
    getTotal,
    isLoading,
    fetchComments,
    addComment,
    editComment,
    removeComment,
    reset,
  };
});
