/**
 * Pure predicate functions mirroring the server-side authorization rules in
 * `api/src/services/authz.service.ts` (see CONTRACT.md §1.4 for the summary
 * table). These are UI-side hints only — the server re-checks every rule
 * itself, so getting one of these wrong client-side is a UX bug, not a
 * security hole. But per repo convention, no role-string literal
 * (`'admin'`, `'hr'`, etc.) should appear directly in a Vue template
 * anywhere in this phase — every such check goes through this file instead.
 */
import type { LeaveRequestDTO, TicketCommentDTO, TicketDTO, UserDTO } from '../api/types';

/**
 * Leave request review (`POST /leave-requests/:id/review`,
 * authz.service.ts has no single exported helper for this — the rule is
 * inlined in `leaveRequest.service.ts::reviewLeaveRequest`):
 *   - `pending` stage: the requester's department manager, OR hr/admin.
 *   - `manager_approved` stage: hr/admin only.
 * "Department manager" is a relationship (`managedDepartmentIds`), not a
 * role — see CONTRACT.md §3.3.
 */
export function canReviewLeave(user: UserDTO | null, leaveRequest: LeaveRequestDTO): boolean {
  if (!user) return false;
  if (user.role === 'hr' || user.role === 'admin') return true;
  if (leaveRequest.status !== 'pending') return false;
  const departmentId = leaveRequest.requester?.departmentId ?? null;
  if (!departmentId) return false;
  return (user.managedDepartmentIds ?? []).includes(departmentId);
}

/** Ticket close (`assertCanCloseTicket`): assignee or global admin only. */
export function canCloseTicket(user: UserDTO | null, ticket: Pick<TicketDTO, 'assignedToId'>): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return ticket.assignedToId === user.id;
}

/** Ticket deletion (`assertCanDeleteTicket`): creator or global admin only. */
export function canDeleteTicket(user: UserDTO | null, ticket: Pick<TicketDTO, 'createdById'>): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return ticket.createdById === user.id;
}

/** Ticket comment edit/delete (`assertCanEditTicketComment`): author or global admin only. */
export function canEditTicketComment(user: UserDTO | null, comment: Pick<TicketCommentDTO, 'authorId'>): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return comment.authorId === user.id;
}

/** User create/update (`POST/PATCH /users`, CONTRACT.md §3.3): admin or hr. */
export function canManageUsers(user: UserDTO | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'hr';
}

/** User soft-delete (`DELETE /users/:id`): admin only. */
export function canDeleteUsers(user: UserDTO | null): boolean {
  if (!user) return false;
  return user.role === 'admin';
}

/** Department create/update/delete (`POST/PATCH/DELETE /departments`): admin or hr for create/update; DELETE is admin-only per CONTRACT.md §3.4, but that distinction is left to callers since this predicate only gates "can manage" broadly. */
export function canManageDepartments(user: UserDTO | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'hr';
}
