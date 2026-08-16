import { ref } from 'vue';
import { defineStore } from 'pinia';
import { useToast } from '@phishyhub/design-system';
import * as ticketsApi from '../../../api/endpoints/tickets';
import { isApiError } from '../../../api/errors';
import type { TicketDTO, TicketPriority, TicketStatus } from '../../../api/types';

const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export interface TicketFilters {
  priority?: TicketPriority;
  assignedToId?: string;
  departmentId?: string;
}

function emptyIdMap(): Map<TicketStatus, string[]> {
  return new Map(TICKET_STATUSES.map((status) => [status, []]));
}

/**
 * Kanban board state, normalized like `stores/messages.ts`: entities by id
 * plus per-column ordered id lists. Each column is fetched independently
 * (`GET /tickets?status=X&pageSize=100`, CONTRACT.md §3.9's pageSize caps at
 * 100) rather than one unfiltered call for the whole board, which would
 * silently truncate a busy board.
 */
export const useTicketsStore = defineStore('tickets', () => {
  const byId = ref<Map<string, TicketDTO>>(new Map());
  const idsByStatus = ref<Map<TicketStatus, string[]>>(emptyIdMap());
  const totalByStatus = ref<Map<TicketStatus, number>>(new Map());
  const hasMoreByStatus = ref<Map<TicketStatus, boolean>>(new Map());
  const loadingByStatus = ref<Map<TicketStatus, boolean>>(new Map());
  const filters = ref<TicketFilters>({});

  function setTicketEntity(ticket: TicketDTO): void {
    byId.value.set(ticket.id, ticket);
  }

  function getTicket(id: string): TicketDTO | undefined {
    return byId.value.get(id);
  }

  function getColumn(status: TicketStatus): TicketDTO[] {
    const ids = idsByStatus.value.get(status) ?? [];
    const out: TicketDTO[] = [];
    for (const id of ids) {
      const ticket = byId.value.get(id);
      if (ticket) out.push(ticket);
    }
    return out;
  }

  function getTotal(status: TicketStatus): number {
    return totalByStatus.value.get(status) ?? getColumn(status).length;
  }

  function getHasMore(status: TicketStatus): boolean {
    return hasMoreByStatus.value.get(status) ?? false;
  }

  function isLoading(status: TicketStatus): boolean {
    return loadingByStatus.value.get(status) ?? false;
  }

  function setFilters(patch: TicketFilters): void {
    filters.value = { ...patch };
  }

  /** One REST call per column — NOT a single unfiltered board-wide call (see module doc comment). */
  async function fetchColumn(status: TicketStatus): Promise<void> {
    loadingByStatus.value.set(status, true);
    try {
      const { items, meta } = await ticketsApi.listTickets({
        status,
        pageSize: 100,
        sort: 'priority',
        order: 'DESC',
        priority: filters.value.priority,
        assignedToId: filters.value.assignedToId,
        departmentId: filters.value.departmentId,
      });
      for (const ticket of items) setTicketEntity(ticket);
      idsByStatus.value.set(status, items.map((t) => t.id));
      totalByStatus.value.set(status, meta.total);
      hasMoreByStatus.value.set(status, items.length < meta.total);
    } finally {
      loadingByStatus.value.set(status, false);
    }
  }

  function fetchAllColumns(): Promise<void[]> {
    return Promise.all(TICKET_STATUSES.map((status) => fetchColumn(status)));
  }

  /** Removes `id` from `fromStatus`'s column and prepends it to `toStatus`'s, adjusting both totals. Shared by the optimistic path and by reconciling a status change that arrived from elsewhere (another user's move via socket). */
  function moveBetweenColumns(id: string, fromStatus: TicketStatus, toStatus: TicketStatus): void {
    if (fromStatus === toStatus) return;
    const fromIds = (idsByStatus.value.get(fromStatus) ?? []).filter((existingId) => existingId !== id);
    idsByStatus.value.set(fromStatus, fromIds);

    const toIds = idsByStatus.value.get(toStatus) ?? [];
    if (!toIds.includes(id)) {
      idsByStatus.value.set(toStatus, [id, ...toIds]);
    }

    totalByStatus.value.set(fromStatus, Math.max(0, (totalByStatus.value.get(fromStatus) ?? 1) - 1));
    totalByStatus.value.set(toStatus, (totalByStatus.value.get(toStatus) ?? 0) + 1);
  }

  /**
   * `POST /tickets/:id/status` — optimistic: mutate local state immediately,
   * then confirm/rollback against the REST response. On failure (e.g. a 403
   * from `assertCanCloseTicket` when a non-assignee/non-admin tries to close
   * a ticket), surgically reverses just this move rather than restoring a
   * whole-array/whole-entity snapshot — `ticket:created`/`updated`/`deleted`
   * broadcast org-wide (CONTRACT.md §4.3), so an unrelated ticket entering
   * or leaving `fromStatus`/`toStatus`, or this same ticket picking up an
   * unrelated field change (assignee/priority), can legitimately land while
   * this request is in flight; a stale snapshot restore would clobber that
   * unrelated state instead of just undoing this one status change.
   */
  async function moveTicket(id: string, toStatus: TicketStatus): Promise<void> {
    const ticket = byId.value.get(id);
    if (!ticket || ticket.status === toStatus) return;
    const fromStatus = ticket.status;

    byId.value.set(id, { ...ticket, status: toStatus });
    moveBetweenColumns(id, fromStatus, toStatus);

    try {
      const updated = await ticketsApi.updateTicketStatus(id, toStatus);
      // Authoritative server state converges with what we already applied
      // optimistically — plain upsert-by-id is enough here (no column/total
      // bookkeeping needed a second time, `existing.status` already matches
      // `updated.status`). The later `ticket:updated` broadcast echoing this
      // same change back through eventBridge.ts hits the same idempotent
      // path in applyTicketUpserted below.
      setTicketEntity(updated);
    } catch (err) {
      // Reverse just this move: only if the ticket still exists (it may have
      // been deleted via a socket echo while we were awaiting, in which case
      // applyTicketDeleted already cleaned up columns/totals correctly and
      // there's nothing to undo) AND is still sitting where we optimistically
      // placed it (if some other authoritative update already moved it
      // elsewhere, that supersedes our optimistic placement — don't fight it).
      const current = byId.value.get(id);
      if (current && current.status === toStatus) {
        moveBetweenColumns(id, toStatus, fromStatus);
        byId.value.set(id, { ...current, status: fromStatus });
      }
      useToast().push({
        title: 'Could not move ticket',
        description: isApiError(err) ? err.message : 'Please try again.',
        variant: 'danger',
      });
    }
  }

  async function assignTicket(id: string, userId: string | null): Promise<void> {
    const ticket = await ticketsApi.assignTicket(id, userId);
    applyTicketUpserted(ticket);
  }

  async function updateTicket(
    id: string,
    patch: { title?: string; description?: string; priority?: TicketPriority; departmentId?: string | null },
  ): Promise<void> {
    const ticket = await ticketsApi.updateTicket(id, patch);
    applyTicketUpserted(ticket);
  }

  async function createTicket(input: {
    title: string;
    description?: string;
    priority?: TicketPriority;
    departmentId?: string;
  }): Promise<TicketDTO> {
    const ticket = await ticketsApi.createTicket(input);
    applyTicketUpserted(ticket);
    return ticket;
  }

  async function deleteTicket(id: string): Promise<void> {
    await ticketsApi.deleteTicket(id);
    applyTicketDeleted(id);
  }

  /**
   * Socket appliers (called from eventBridge.ts only) AND the merge point
   * for every REST response above — same "upsert-by-id, reconcile columns
   * only if the status actually differs" logic either way.
   *
   * Idempotency / echo-back: a `ticket:updated` broadcast for a change we
   * just made ourselves (e.g. via `moveTicket`'s optimistic update) arrives
   * with `existing.status` already equal to the incoming `ticket.status` —
   * that branch is skipped, so applying the echo again can't fight or
   * revert the state we already have. A status change that originated
   * elsewhere (another user's move) instead finds `existing.status`
   * different from the incoming value and reconciles the columns/totals
   * exactly once.
   */
  function applyTicketUpserted(ticket: TicketDTO): void {
    const existing = byId.value.get(ticket.id);
    setTicketEntity(ticket);

    if (!existing) {
      const ids = idsByStatus.value.get(ticket.status) ?? [];
      if (!ids.includes(ticket.id)) {
        idsByStatus.value.set(ticket.status, [ticket.id, ...ids]);
        totalByStatus.value.set(ticket.status, (totalByStatus.value.get(ticket.status) ?? 0) + 1);
      }
      return;
    }

    if (existing.status !== ticket.status) {
      moveBetweenColumns(ticket.id, existing.status, ticket.status);
    }
  }

  function applyTicketDeleted(id: string): void {
    const ticket = byId.value.get(id);
    if (!ticket) return;
    byId.value.delete(id);
    const ids = (idsByStatus.value.get(ticket.status) ?? []).filter((existingId) => existingId !== id);
    idsByStatus.value.set(ticket.status, ids);
    totalByStatus.value.set(ticket.status, Math.max(0, (totalByStatus.value.get(ticket.status) ?? 1) - 1));
  }

  function reset(): void {
    byId.value = new Map();
    idsByStatus.value = emptyIdMap();
    totalByStatus.value = new Map();
    hasMoreByStatus.value = new Map();
    loadingByStatus.value = new Map();
    filters.value = {};
  }

  return {
    byId,
    filters,
    getTicket,
    getColumn,
    getTotal,
    getHasMore,
    isLoading,
    setFilters,
    fetchColumn,
    fetchAllColumns,
    moveTicket,
    assignTicket,
    updateTicket,
    createTicket,
    deleteTicket,
    applyTicketUpserted,
    applyTicketDeleted,
    reset,
  };
});
