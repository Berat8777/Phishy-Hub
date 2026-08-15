import { LeaveRequest, User } from '../models';
import { assertCanReviewLeaveRequest, assertOwnsLeaveRequestOrPrivileged } from './authz.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { paginate, PaginationParams } from './pagination.service';
import { createNotification } from './notification.service';
import type { LeaveRequestStatus, LeaveRequestType, UserRole } from '../utils/constants';

const REQUESTER_INCLUDE = [
  { model: User, as: 'requester', attributes: ['id', 'firstName', 'lastName', 'email'] },
  { model: User, as: 'reviewer', attributes: ['id', 'firstName', 'lastName', 'email'] },
];

async function getOrThrow(id: string): Promise<InstanceType<typeof LeaveRequest>> {
  const leaveRequest = await LeaveRequest.findByPk(id, { include: REQUESTER_INCLUDE });
  if (!leaveRequest) throw new NotFoundError('Leave request not found');
  return leaveRequest;
}

export async function createLeaveRequest(
  userId: string,
  input: { type: LeaveRequestType; startDate: string; endDate: string; reason?: string },
): Promise<InstanceType<typeof LeaveRequest>> {
  if (new Date(input.endDate) < new Date(input.startDate)) {
    throw new BadRequestError('endDate must be on or after startDate');
  }
  const leaveRequest = await LeaveRequest.create({
    userId,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason ?? null,
    status: 'pending',
  });
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
    where.userId = userId;
  }
  return paginate(LeaveRequest, params, { where, include: REQUESTER_INCLUDE });
}

export async function getLeaveRequestById(
  userId: string,
  role: UserRole,
  id: string,
): Promise<InstanceType<typeof LeaveRequest>> {
  const leaveRequest = await getOrThrow(id);
  assertOwnsLeaveRequestOrPrivileged(leaveRequest, userId, role);
  return leaveRequest;
}

export async function reviewLeaveRequest(
  reviewerId: string,
  role: UserRole,
  id: string,
  input: { status: 'approved' | 'rejected'; reviewNote?: string },
): Promise<InstanceType<typeof LeaveRequest>> {
  assertCanReviewLeaveRequest(role);
  const leaveRequest = await getOrThrow(id);
  if (leaveRequest.status !== 'pending') {
    throw new BadRequestError(`Cannot review a leave request in status "${leaveRequest.status}"`);
  }

  leaveRequest.status = input.status;
  leaveRequest.reviewedById = reviewerId;
  leaveRequest.reviewedAt = new Date();
  leaveRequest.reviewNote = input.reviewNote ?? null;
  await leaveRequest.save();

  await createNotification(leaveRequest.userId, 'leave_request_reviewed', {
    leaveRequestId: leaveRequest.id,
    status: leaveRequest.status,
  });

  return getOrThrow(leaveRequest.id);
}

export async function cancelLeaveRequest(
  userId: string,
  role: UserRole,
  id: string,
): Promise<InstanceType<typeof LeaveRequest>> {
  const leaveRequest = await getOrThrow(id);
  assertOwnsLeaveRequestOrPrivileged(leaveRequest, userId, role);
  if (leaveRequest.status !== 'pending') {
    throw new BadRequestError(`Cannot cancel a leave request in status "${leaveRequest.status}"`);
  }
  leaveRequest.status = 'cancelled';
  await leaveRequest.save();
  return getOrThrow(leaveRequest.id);
}
