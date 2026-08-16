import { http } from '../http';
import type { LeaveCalendarEntryDTO } from '../types';

/**
 * `GET /leave-calendar` — a dedicated top-level endpoint (NOT nested under
 * `/leave-requests`), see CONTRACT.md §11.2. Range capped server-side at
 * ~92 days (400 if exceeded); callers of this module fetch per-visible-month
 * to stay well within that.
 */
export function getLeaveCalendar(params: { from: string; to: string; departmentId?: string }): Promise<
  LeaveCalendarEntryDTO[]
> {
  return http.get<LeaveCalendarEntryDTO[]>('/leave-calendar', { query: params }).then((r) => r.data);
}
