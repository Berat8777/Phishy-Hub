/** Small date-formatting helpers shared across chat views. All DTO timestamps are ISO 8601 strings (CONTRACT.md DTOs). */

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Today" / "Yesterday" / a full date — used by DayDivider.vue. */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(iso);
}

/**
 * Formats a `'YYYY-MM-DD'` date-only string (LeaveRequest/LeaveCalendar
 * DTOs, CONTRACT.md §3.8) for display — parses via `Date.UTC` and reads
 * back with `timeZone: 'UTC'`, so the calendar date can never shift a day
 * near a local-timezone midnight boundary (same rationale as
 * `PhCalendarMonth`'s grid math and `api/src/utils/dates.ts`).
 */
export function formatDateOnly(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Mon-Fri inclusive count between two `'YYYY-MM-DD'` date-only strings —
 * mirrors `api/src/utils/dates.ts::countBusinessDays` exactly (same
 * `Date.UTC`-only arithmetic, no holiday calendar) so the client-side
 * "this may exceed your remaining balance" warning
 * (`features/hr/components/LeaveRequestForm.vue`) lines up with what the
 * server will eventually derive for `usedDays`/`pendingDays`
 * (CONTRACT.md §3.8). This is purely informational on the client — the
 * server never rejects a request for exceeding balance.
 */
export function countBusinessDays(startDateStr: string, endDateStr: string): number {
  const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const parse = (s: string): Date => {
    const match = DATE_ONLY_RE.exec(s);
    if (!match) throw new Error(`Invalid date-only string: "${s}"`);
    const [, year, month, day] = match;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  };

  const start = parse(startDateStr);
  const end = parse(endDateStr);
  if (start.getTime() > end.getTime()) return 0;

  let count = 0;
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(iso);
}
