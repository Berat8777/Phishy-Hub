/**
 * String/UTC-safe date-only ('YYYY-MM-DD') arithmetic — the shape Sequelize
 * `DATEONLY` columns (LeaveRequest.startDate/endDate) return in JS.
 *
 * Deliberately never uses `new Date('YYYY-MM-DD')` local-time parsing: that
 * constructor treats a bare date string as UTC midnight, then every
 * `.getDay()`/`.getDate()`-style read reinterprets it in the *local*
 * timezone, which shifts the apparent date backward by a day for any
 * timezone west of UTC. All parsing here goes through `Date.UTC(...)` and
 * all reads use the `getUTC*` accessors, so the calendar date never moves.
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a 'YYYY-MM-DD' string into a UTC-midnight Date (not local-time). */
export function parseDateOnly(dateStr: string): Date {
  const match = DATE_ONLY_RE.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid date-only string: "${dateStr}"`);
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/** Formats a UTC-midnight Date back to 'YYYY-MM-DD'. */
export function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `a` compared to `b`: negative if a<b, 0 if equal, positive if a>b. Pure string compare works for 'YYYY-MM-DD'. */
export function compareDateOnly(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** True if [aStart,aEnd] and [bStart,bEnd] (inclusive, 'YYYY-MM-DD') share at least one day. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return compareDateOnly(aStart, bEnd) <= 0 && compareDateOnly(bStart, aEnd) <= 0;
}

/** Mon-Fri inclusive count between two 'YYYY-MM-DD' dates (inclusive on both ends). No holiday calendar (out of scope). */
export function countBusinessDays(startDateStr: string, endDateStr: string): number {
  const start = parseDateOnly(startDateStr);
  const end = parseDateOnly(endDateStr);
  if (start.getTime() > end.getTime()) return 0;

  let count = 0;
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    const dayOfWeek = cursor.getUTCDay(); // 0=Sun ... 6=Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/**
 * Splits a [startDateStr, endDateStr] range's business-day count across the
 * calendar year(s) it touches — a request spanning Dec 29 - Jan 3 counts
 * separately toward each year's balance. Returns one entry per year touched
 * (only years with a non-zero count are included).
 */
export function splitBusinessDaysByYear(startDateStr: string, endDateStr: string): Array<{ year: number; businessDays: number }> {
  const startYear = parseDateOnly(startDateStr).getUTCFullYear();
  const endYear = parseDateOnly(endDateStr).getUTCFullYear();

  if (startYear === endYear) {
    const businessDays = countBusinessDays(startDateStr, endDateStr);
    return businessDays > 0 ? [{ year: startYear, businessDays }] : [];
  }

  const results: Array<{ year: number; businessDays: number }> = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const segmentStart = year === startYear ? startDateStr : `${year}-01-01`;
    const segmentEnd = year === endYear ? endDateStr : `${year}-12-31`;
    const businessDays = countBusinessDays(segmentStart, segmentEnd);
    if (businessDays > 0) results.push({ year, businessDays });
  }
  return results;
}
