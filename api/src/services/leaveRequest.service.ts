import { Op } from 'sequelize';
import { LeaveRequest, LeaveRequestReview, LeaveBalance, User, Department } from '../models';
import {
  assertOwnsLeaveRequestOrPrivileged,
  assertCanViewLeaveBalance,
  isManagerOfUser,
  getManagedDepartmentIds,
} from './authz.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { paginate, PaginationParams } from './pagination.service';
import { createNotification } from './notification.service';
import { compareDateOnly, parseDateOnly, splitBusinessDaysByYear } from '../utils/dates';
import {
  LEAVE_REQUEST_ACTIVE_STATUSES,
  LEAVE_REQUEST_TYPES,
  LEAVE_TYPE_DEDUCTS_ENTITLEMENT,
  LeaveRequestReviewStage,
} from '../utils/constants';
import type { LeaveRequestStatus, LeaveRequestType, UserRole } from '../utils/constants';

const REQUESTER_INCLUDE = [
  { model: User, as: 'requester', attributes: ['id', 'firstName', 'lastName', 'email', 'departmentId', 'avatarFileId'] },
  { model: User, as: 'reviewer', attributes: ['id', 'firstName', 'lastName', 'email'] },
];

const CALENDAR_MAX_RANGE_DAYS = 92;

async function getOrThrow(id: string): Promise<InstanceType<typeof LeaveRequest>> {
  const leaveRequest = await LeaveRequest.findByPk(id, { include: REQUESTER_INCLUDE });
  if (!leaveRequest) throw new NotFoundError('Leave request not found');
  return leaveRequest;
}

/**
 * Resolves the requester's department manager, if any, and whether the
 * request should auto-skip straight to `manager_approved` at creation time
 * — true when there's no valid stage-1 reviewer: no department, the
 * department has no `managerId`, or the requester IS the department's
 * manager (can't review their own request).
 */
async function resolveFirstStageReviewer(
  requesterId: string,
): Promise<{ managerId: string | null; autoSkip: boolean }> {
  const requester = await User.findByPk(requesterId);
  if (!requester?.departmentId) return { managerId: null, autoSkip: true };

  const department = await Department.findByPk(requester.departmentId);
  if (!department?.managerId) return { managerId: null, autoSkip: true };
  if (department.managerId === requesterId) return { managerId: department.managerId, autoSkip: true };

  return { managerId: department.managerId, autoSkip: false };
}

async function notifyFirstStageReviewer(
  leaveRequest: InstanceType<typeof LeaveRequest>,
  managerId: string | null,
  autoSkip: boolean,
): Promise<void> {
  const payload = {
    leaveRequestId: leaveRequest.id,
    requesterId: leaveRequest.userId,
    type: leaveRequest.type,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    status: leaveRequest.status,
  };

  if (!autoSkip && managerId) {
    await createNotification(managerId, 'leave_request_submitted', payload);
    return;
  }

  // Auto-skipped straight to manager_approved (no department manager to
  // notify) — the effective first-stage reviewer is now hr/admin, so notify
  // everyone who can act on it.
  const hrAdmins = await User.findAll({ where: { role: { [Op.in]: ['hr', 'admin'] } } });
  await Promise.all(hrAdmins.map((u) => createNotification(u.id, 'leave_request_submitted', payload)));
}

export async function createLeaveRequest(
  userId: string,
  input: { type: LeaveRequestType; startDate: string; endDate: string; reason?: string },
): Promise<InstanceType<typeof LeaveRequest>> {
  if (compareDateOnly(input.endDate, input.startDate) < 0) {
    throw new BadRequestError('endDate must be on or after startDate');
  }

  const overlapping = await LeaveRequest.findOne({
    where: {
      userId,
      status: { [Op.in]: LEAVE_REQUEST_ACTIVE_STATUSES },
      startDate: { [Op.lte]: input.endDate },
      endDate: { [Op.gte]: input.startDate },
    },
  });
  if (overlapping) {
    throw new BadRequestError('This date range overlaps an existing leave request');
  }

  const { managerId, autoSkip } = await resolveFirstStageReviewer(userId);

  const leaveRequest = await LeaveRequest.create({
    userId,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason ?? null,
    status: autoSkip ? 'manager_approved' : 'pending',
  });

  await notifyFirstStageReviewer(leaveRequest, managerId, autoSkip);

  return getOrThrow(leaveRequest.id);
}

export async function listLeaveRequests(
  userId: string,
  role: UserRole,
  params: PaginationParams & { status?: LeaveRequestStatus; userId?: string },
) {
  const isPrivileged = role === 'hr' || role === 'admin';
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (isPrivileged) {
    if (params.userId) where.userId = params.userId;
  } else {
    // Department managers additionally need to discover their reports'
    // requests (to build an approvals queue) without knowing ids up front —
    // same manager relationship reviewLeaveRequest() already trusts, just
    // consulted here too. A caller who manages no department falls back to
    // the plain "own requests only" behavior (unchanged for the common case).
    const managedDepartmentIds = await getManagedDepartmentIds(userId);
    if (managedDepartmentIds.length > 0) {
      const reports = await User.findAll({ where: { departmentId: { [Op.in]: managedDepartmentIds } }, attributes: ['id'] });
      where[Op.or as unknown as string] = [
        { userId },
        { userId: { [Op.in]: reports.map((u) => u.id) } },
      ];
    } else {
      where.userId = userId;
    }
  }
  return paginate(LeaveRequest, params, { where, include: REQUESTER_INCLUDE });
}

export async function getLeaveRequestById(
  userId: string,
  role: UserRole,
  id: string,
): Promise<InstanceType<typeof LeaveRequest>> {
  const leaveRequest = await getOrThrow(id);
  const isPrivileged = role === 'hr' || role === 'admin';
  if (leaveRequest.userId !== userId && !isPrivileged && !(await isManagerOfUser(userId, leaveRequest.userId))) {
    throw new ForbiddenError('You do not have access to this leave request');
  }
  return leaveRequest;
}

/**
 * Two-stage approval chain (architecture doc §1):
 *   pending          -> manager_approved | rejected   (department manager, OR hr/admin who skip the stage)
 *   manager_approved -> approved | rejected            (hr/admin only)
 * The resulting status is derived from (current status, reviewer's
 * relationship to the request) — the client only ever sends a `decision`.
 */
export async function reviewLeaveRequest(
  reviewerId: string,
  role: UserRole,
  id: string,
  input: { decision: 'approve' | 'reject'; reviewNote?: string },
): Promise<InstanceType<typeof LeaveRequest>> {
  const leaveRequest = await getOrThrow(id);
  const isPrivileged = role === 'hr' || role === 'admin';

  let stage: LeaveRequestReviewStage;
  if (leaveRequest.status === 'pending') {
    if (!isPrivileged && !(await isManagerOfUser(reviewerId, leaveRequest.userId))) {
      throw new ForbiddenError('Only the department manager or HR/admin can review this leave request');
    }
    stage = 'manager';
  } else if (leaveRequest.status === 'manager_approved') {
    if (!isPrivileged) {
      throw new ForbiddenError('Only HR or admin can give final approval on a leave request');
    }
    stage = 'hr';
  } else {
    throw new BadRequestError(`Cannot review a leave request in status "${leaveRequest.status}"`);
  }

  const resultingStatus: LeaveRequestStatus =
    input.decision === 'approve' ? (stage === 'manager' ? 'manager_approved' : 'approved') : 'rejected';

  leaveRequest.status = resultingStatus;
  leaveRequest.reviewedById = reviewerId;
  leaveRequest.reviewedAt = new Date();
  leaveRequest.reviewNote = input.reviewNote ?? null;
  await leaveRequest.save();

  await LeaveRequestReview.create({
    leaveRequestId: leaveRequest.id,
    reviewerId,
    stage,
    decision: input.decision,
    note: input.reviewNote ?? null,
  });

  await createNotification(leaveRequest.userId, 'leave_request_reviewed', {
    leaveRequestId: leaveRequest.id,
    status: leaveRequest.status,
  });

  return getOrThrow(leaveRequest.id);
}

const OWNER_CANCELLABLE_STATUSES: LeaveRequestStatus[] = ['pending', 'manager_approved'];
const PRIVILEGED_CANCELLABLE_STATUSES: LeaveRequestStatus[] = ['pending', 'manager_approved', 'approved'];

/**
 * Owner may cancel only before the final decision (pending/manager_approved).
 * hr/admin may cancel at any pre-terminal state, including `approved` — HR
 * needs to be able to handle post-approval plan changes, which also
 * releases the balance since usage is derived from live status, not stored.
 */
export async function cancelLeaveRequest(
  userId: string,
  role: UserRole,
  id: string,
): Promise<InstanceType<typeof LeaveRequest>> {
  const leaveRequest = await getOrThrow(id);
  assertOwnsLeaveRequestOrPrivileged(leaveRequest, userId, role);

  const isPrivileged = role === 'hr' || role === 'admin';
  const allowedStatuses = isPrivileged ? PRIVILEGED_CANCELLABLE_STATUSES : OWNER_CANCELLABLE_STATUSES;
  if (!allowedStatuses.includes(leaveRequest.status)) {
    throw new BadRequestError(`Cannot cancel a leave request in status "${leaveRequest.status}"`);
  }

  leaveRequest.status = 'cancelled';
  await leaveRequest.save();
  return getOrThrow(leaveRequest.id);
}

export interface LeaveBalanceEntry {
  type: LeaveRequestType;
  entitledDays: number;
  carriedOverDays: number;
  usedDays: number;
  pendingDays: number;
  /** null for types that don't deduct against entitlement (only LEAVE_TYPE_DEDUCTS_ENTITLEMENT does). */
  remainingDays: number | null;
}

/** Sums each request's business days that fall within `year`, grouped by leave type. */
function sumBusinessDaysByType(requests: InstanceType<typeof LeaveRequest>[], year: number): Map<LeaveRequestType, number> {
  const totals = new Map<LeaveRequestType, number>();
  for (const request of requests) {
    const segments = splitBusinessDaysByYear(request.startDate, request.endDate);
    const segment = segments.find((s) => s.year === year);
    if (!segment) continue;
    totals.set(request.type, (totals.get(request.type) ?? 0) + segment.businessDays);
  }
  return totals;
}

export async function getLeaveBalance(
  callerId: string,
  role: UserRole,
  targetUserId: string,
  year: number,
): Promise<LeaveBalanceEntry[]> {
  await assertCanViewLeaveBalance(callerId, role, targetUserId);

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [balanceRows, approvedRequests, pendingRequests] = await Promise.all([
    LeaveBalance.findAll({ where: { userId: targetUserId, year } }),
    LeaveRequest.findAll({
      where: { userId: targetUserId, status: 'approved', startDate: { [Op.lte]: yearEnd }, endDate: { [Op.gte]: yearStart } },
    }),
    LeaveRequest.findAll({
      where: {
        userId: targetUserId,
        status: { [Op.in]: ['pending', 'manager_approved'] },
        startDate: { [Op.lte]: yearEnd },
        endDate: { [Op.gte]: yearStart },
      },
    }),
  ]);

  const balanceByType = new Map(balanceRows.map((b) => [b.type, b]));
  const usedByType = sumBusinessDaysByType(approvedRequests, year);
  const pendingByType = sumBusinessDaysByType(pendingRequests, year);

  return LEAVE_REQUEST_TYPES.map((type) => {
    const balance = balanceByType.get(type);
    const entitledDays = balance ? Number(balance.entitledDays) : 0;
    const carriedOverDays = balance ? Number(balance.carriedOverDays) : 0;
    const usedDays = usedByType.get(type) ?? 0;
    const pendingDays = pendingByType.get(type) ?? 0;
    const deductsEntitlement = type === LEAVE_TYPE_DEDUCTS_ENTITLEMENT;
    return {
      type,
      entitledDays,
      carriedOverDays,
      usedDays,
      pendingDays,
      remainingDays: deductsEntitlement ? entitledDays + carriedOverDays - usedDays - pendingDays : null,
    };
  });
}

export interface LeaveCalendarEntry {
  id: string;
  userId: string;
  user: { id: string; firstName: string; lastName: string; avatarFileId: string | null; departmentId: string | null };
  type: LeaveRequestType;
  status: LeaveRequestStatus;
  startDate: string;
  endDate: string;
}

/**
 * `GET /leave-calendar` — structurally its own redacted projection (never
 * `reason`/`reviewNote`), NOT a filtered version of the full leave-request
 * DTO, so the redaction can't regress if that DTO grows fields later.
 */
export async function getLeaveCalendar(
  callerId: string,
  role: UserRole,
  params: { from: string; to: string; departmentId?: string },
): Promise<LeaveCalendarEntry[]> {
  if (compareDateOnly(params.to, params.from) < 0) {
    throw new BadRequestError('to must be on or after from');
  }
  const rangeDays = Math.round((parseDateOnly(params.to).getTime() - parseDateOnly(params.from).getTime()) / 86_400_000) + 1;
  if (rangeDays > CALENDAR_MAX_RANGE_DAYS) {
    throw new BadRequestError(`Date range cannot exceed ${CALENDAR_MAX_RANGE_DAYS} days`);
  }

  const isPrivileged = role === 'hr' || role === 'admin';
  let departmentId = params.departmentId;

  if (departmentId) {
    if (!isPrivileged) {
      const caller = await User.findByPk(callerId);
      if (!caller || caller.departmentId !== departmentId) {
        throw new ForbiddenError('You can only view your own department calendar');
      }
    }
  } else {
    const caller = await User.findByPk(callerId);
    if (!caller?.departmentId) {
      throw new BadRequestError('You have no department — pass departmentId explicitly (hr/admin only)');
    }
    departmentId = caller.departmentId;
  }

  const requests = await LeaveRequest.findAll({
    where: {
      status: { [Op.in]: LEAVE_REQUEST_ACTIVE_STATUSES },
      startDate: { [Op.lte]: params.to },
      endDate: { [Op.gte]: params.from },
    },
    include: [
      {
        model: User,
        as: 'requester',
        attributes: ['id', 'firstName', 'lastName', 'avatarFileId', 'departmentId'],
        where: { departmentId },
        required: true,
      },
    ],
  });

  return requests.map((r) => {
    const requester = r.requester!;
    return {
      id: r.id,
      userId: r.userId,
      user: {
        id: requester.id,
        firstName: requester.firstName,
        lastName: requester.lastName,
        avatarFileId: requester.avatarFileId ?? null,
        departmentId: requester.departmentId ?? null,
      },
      type: r.type,
      status: r.status,
      startDate: r.startDate,
      endDate: r.endDate,
    };
  });
}
