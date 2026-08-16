import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as leaveRequestsApi from '../../../api/endpoints/leaveRequests';
import * as leaveCalendarApi from '../../../api/endpoints/leaveCalendar';
import { isApiError } from '../../../api/errors';
import { useAuthStore } from '../../../stores/auth';
import { useNotificationsStore } from '../../../stores/notifications';
import { useUsersStore } from '../../../stores/users';
import type {
  LeaveBalanceDTO,
  LeaveCalendarEntryDTO,
  LeaveRequestDTO,
  LeaveRequestPersonDTO,
  LeaveRequestReviewDecision,
  LeaveRequestType,
  NotificationDTO,
} from '../../../api/types';

/**
 * Best-effort reconstruction of a `LeaveRequestDTO` from a
 * `leave_request_submitted` notification's payload
 * (`{leaveRequestId, requesterId, type, startDate, endDate, status}`,
 * CONTRACT.md §3.8). Only used by `fetchApprovalsQueue()`'s
 * plain-department-manager branch — see that function's doc comment for
 * why this workaround exists at all.
 */
async function leaveRequestFromNotification(notification: NotificationDTO): Promise<LeaveRequestDTO | null> {
  const payload = notification.payload as Partial<{
    leaveRequestId: string;
    requesterId: string;
    type: LeaveRequestType;
    startDate: string;
    endDate: string;
    status: LeaveRequestDTO['status'];
  }>;
  if (
    !payload.leaveRequestId ||
    !payload.requesterId ||
    !payload.type ||
    !payload.startDate ||
    !payload.endDate ||
    !payload.status
  ) {
    return null;
  }

  let requester: LeaveRequestPersonDTO | null = null;
  try {
    const user = await useUsersStore().fetchUser(payload.requesterId);
    requester = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      departmentId: user.departmentId,
      avatarFileId: user.avatarFileId,
    };
  } catch {
    requester = null;
  }

  return {
    id: payload.leaveRequestId,
    userId: payload.requesterId,
    type: payload.type,
    startDate: payload.startDate,
    endDate: payload.endDate,
    reason: null,
    status: payload.status,
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: notification.createdAt,
    updatedAt: notification.createdAt,
    requester,
    reviewer: null,
  };
}

/**
 * One store for the whole HR domain (my requests, the approvals queue,
 * balance, team calendar) per the architect's design — not split into
 * per-concern stores like the boards feature's tickets/ticketComments
 * split, since these four concerns are read together on the same 3 pages.
 */
export const useLeaveStore = defineStore('leave', () => {
  const myRequests = ref<LeaveRequestDTO[]>([]);
  const myRequestsLoading = ref(false);

  const approvalsQueue = ref<LeaveRequestDTO[]>([]);
  const approvalsLoading = ref(false);
  /** Ids reviewed this session — filtered out of a notification-derived queue immediately, since that branch has no way to re-confirm server truth (see `fetchApprovalsQueue`). Session-only; cleared by `reset()`. */
  const dismissedApprovalIds = ref<Set<string>>(new Set());

  const balance = ref<LeaveBalanceDTO[]>([]);
  const balanceYear = ref(new Date().getUTCFullYear());
  const balanceLoading = ref(false);

  const calendarEntries = ref<LeaveCalendarEntryDTO[]>([]);
  const calendarLoading = ref(false);

  function upsertMyRequest(request: LeaveRequestDTO): void {
    const index = myRequests.value.findIndex((r) => r.id === request.id);
    if (index === -1) {
      myRequests.value = [request, ...myRequests.value];
    } else {
      const next = myRequests.value.slice();
      next.splice(index, 1, request);
      myRequests.value = next;
    }
  }

  async function fetchMyRequests(): Promise<void> {
    myRequestsLoading.value = true;
    try {
      const { items } = await leaveRequestsApi.listLeaveRequests({
        pageSize: 100,
        sort: 'startDate',
        order: 'DESC',
      });
      myRequests.value = items;
    } finally {
      myRequestsLoading.value = false;
    }
  }

  async function createRequest(input: {
    type: LeaveRequestType;
    startDate: string;
    endDate: string;
    reason?: string;
  }): Promise<LeaveRequestDTO> {
    const created = await leaveRequestsApi.createLeaveRequest(input);
    upsertMyRequest(created);
    return created;
  }

  async function cancelRequest(id: string): Promise<void> {
    const updated = await leaveRequestsApi.cancelLeaveRequest(id);
    upsertMyRequest(updated);
  }

  /**
   * Requests the current user can act on: `pending` at a department they
   * manage, OR `manager_approved` if they're hr/admin (CONTRACT.md §1.4/§3.8).
   *
   * hr/admin: straightforward — `GET /leave-requests?status=` lists ALL
   * requests for privileged callers, so this merges the `pending` and
   * `manager_approved` pages (hr/admin can act at both stages).
   *
   * Plain department manager (not hr/admin): **confirmed backend gap** —
   * `leaveRequest.service.ts::listLeaveRequests` always forces
   * `where.userId = callerId` for non-privileged callers regardless of any
   * `userId` query param, and `getLeaveRequestById`
   * (`GET /leave-requests/:id`) gates on
   * `assertOwnsLeaveRequestOrPrivileged` (owner or hr/admin only — no
   * department-manager exception, unlike the review endpoint's own
   * `isManagerOfUser` check). So a plain manager can successfully call
   * `POST /leave-requests/:id/review` for a subordinate's request, but has
   * NO REST-reachable way to discover that request's id/details in the
   * first place. The only channel that actually reaches them is the
   * `leave_request_submitted` notification fired at submission time
   * (`leaveRequest.service.ts::notifyFirstStageReviewer`), whose payload
   * carries `{leaveRequestId, requesterId, type, startDate, endDate,
   * status}` — reconstructed here via `leaveRequestFromNotification`. This
   * means: (a) requests submitted during the current session work
   * correctly, (b) requests that predate the manager's current
   * notification history (e.g. seeded directly into the DB, or paginated
   * out) will NOT appear. See this pass's HANDOFF for the recommended
   * backend fix.
   */
  async function fetchApprovalsQueue(): Promise<void> {
    const user = useAuthStore().user;
    if (!user) {
      approvalsQueue.value = [];
      return;
    }

    approvalsLoading.value = true;
    try {
      if (user.role === 'hr' || user.role === 'admin') {
        const [pendingRes, managerApprovedRes] = await Promise.all([
          leaveRequestsApi.listLeaveRequests({ status: 'pending', pageSize: 100 }),
          leaveRequestsApi.listLeaveRequests({ status: 'manager_approved', pageSize: 100 }),
        ]);
        approvalsQueue.value = [...pendingRes.items, ...managerApprovedRes.items];
        return;
      }

      const notificationsStore = useNotificationsStore();
      await notificationsStore.fetchNotifications();
      const candidates = notificationsStore.items.filter((n) => n.type === 'leave_request_submitted');
      const resolved = await Promise.all(candidates.map(leaveRequestFromNotification));

      const seen = new Set<string>();
      const items: LeaveRequestDTO[] = [];
      for (const item of resolved) {
        if (!item || seen.has(item.id) || dismissedApprovalIds.value.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
      approvalsQueue.value = items;
    } finally {
      approvalsLoading.value = false;
    }
  }

  /**
   * `POST /leave-requests/:id/review` — new `{decision, reviewNote?}` body
   * shape (CONTRACT.md §3.8).
   *
   * On a failure that indicates the request is no longer reviewable by this
   * caller, also evicts the id from `approvalsQueue`/`dismissedApprovalIds`.
   * Confirmed live (not just by reading the service code) that this can
   * surface as any of THREE status codes depending on how far the request
   * moved on since the queue entry was built, all thrown by
   * `leaveRequest.service.ts::reviewLeaveRequest`:
   *   - `400 BAD_REQUEST` — the request already reached a terminal status
   *     (`approved`/`rejected`/`cancelled`), the `else` branch's
   *     `Cannot review a leave request in status "..."`.
   *   - `403 FORBIDDEN` — the request moved from `pending` to
   *     `manager_approved` (e.g. hr/admin acted at the pending stage ahead
   *     of the department manager) and this caller isn't hr/admin, so the
   *     `manager_approved` branch's privilege check now rejects them —
   *     `Only HR or admin can give final approval on this leave request`.
   *     This is the single most likely case for the notification-derived
   *     queue (see below), and was NOT covered by treating only 400/404 as
   *     stale — verified via a live repro (hr resolves a request before the
   *     department manager can act on it; the manager's retry then 403s
   *     forever without this).
   *   - `404 NOT_FOUND` — the id no longer resolves at all.
   *
   * This matters most for the notification-derived queue built in
   * `fetchApprovalsQueue` for plain department managers: its entries'
   * `status` is frozen at submission time and never re-verified against
   * server truth, so a request already resolved by someone else (hr/admin
   * skipping ahead, or a co-manager) or cancelled by the requester would
   * otherwise linger in the queue forever, failing the same way on every
   * retry. Rethrows so the caller (`ReviewDialog.vue`) still shows its own
   * toast — same store/component error-handling split as the rest of this
   * store's plain wrapper actions (`createRequest`, `cancelRequest`).
   */
  async function reviewRequest(
    id: string,
    decision: LeaveRequestReviewDecision,
    reviewNote?: string,
  ): Promise<LeaveRequestDTO> {
    try {
      const updated = await leaveRequestsApi.reviewLeaveRequest(id, { decision, reviewNote });
      dismissedApprovalIds.value.add(id);
      approvalsQueue.value = approvalsQueue.value.filter((r) => r.id !== id);
      // The reviewer may also be the requester's own list elsewhere (rare, but harmless to keep in sync).
      const ownIndex = myRequests.value.findIndex((r) => r.id === id);
      if (ownIndex !== -1) upsertMyRequest(updated);
      return updated;
    } catch (err) {
      if (isApiError(err) && (err.status === 400 || err.status === 403 || err.status === 404)) {
        dismissedApprovalIds.value.add(id);
        approvalsQueue.value = approvalsQueue.value.filter((r) => r.id !== id);
      }
      throw err;
    }
  }

  async function fetchBalance(year?: number): Promise<void> {
    const targetYear = year ?? balanceYear.value;
    balanceYear.value = targetYear;
    balanceLoading.value = true;
    try {
      balance.value = await leaveRequestsApi.getLeaveBalance({ year: targetYear });
    } finally {
      balanceLoading.value = false;
    }
  }

  async function fetchCalendar(from: string, to: string, departmentId?: string): Promise<void> {
    calendarLoading.value = true;
    try {
      calendarEntries.value = await leaveCalendarApi.getLeaveCalendar({ from, to, departmentId });
    } finally {
      calendarLoading.value = false;
    }
  }

  function reset(): void {
    myRequests.value = [];
    myRequestsLoading.value = false;
    approvalsQueue.value = [];
    approvalsLoading.value = false;
    dismissedApprovalIds.value = new Set();
    balance.value = [];
    balanceYear.value = new Date().getUTCFullYear();
    balanceLoading.value = false;
    calendarEntries.value = [];
    calendarLoading.value = false;
  }

  return {
    myRequests,
    myRequestsLoading,
    approvalsQueue,
    approvalsLoading,
    balance,
    balanceYear,
    balanceLoading,
    calendarEntries,
    calendarLoading,
    fetchMyRequests,
    createRequest,
    cancelRequest,
    fetchApprovalsQueue,
    reviewRequest,
    fetchBalance,
    fetchCalendar,
    reset,
  };
});
