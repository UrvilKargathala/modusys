// Leave rules for My Leaves and Leave Approvals, the same as the website's (shared/attendance-config.ts,
// web/components/leaves/leave-apply-form.tsx). Kept free of React so they can be tested.
import { LEAVE_TYPES } from '@shared/attendance-config';
import type { Leave } from '../api/leaves';
import { formatDate } from './format';

export { LEAVE_TYPES };

const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/** Weekdays (Monday-Friday) from `from` to `to` inclusive, YYYY-MM-DD; 0 when the range is backwards. */
export function weekdaysBetween(from: string, to: string): number {
  if (!from || !to || to < from) return 0;
  let n = 0;
  for (let t = day(from); t <= day(to); t += 86_400_000) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

/** As the website's form: a half day is 0.5 (on one date), otherwise the weekdays in the range. */
export function leaveDays(from: string, to: string, halfDay: boolean): number {
  if (halfDay) return from ? 0.5 : 0;
  return weekdaysBetween(from, to || from);
}

/** "Casual", or the custom label typed for Other. */
export function leaveTypeLabel(l: Pick<Leave, 'leaveType' | 'customLeaveType'>): string {
  if (l.leaveType === 'OTHER' && l.customLeaveType) return l.customLeaveType;
  return LEAVE_TYPES.find((t) => t.value === l.leaveType)?.label ?? l.leaveType;
}

/** "24/11/2026 · First half", "24/11/2026 – 26/11/2026 · 3 days". */
export function leaveWhen(l: Pick<Leave, 'fromDate' | 'toDate' | 'totalDays' | 'isHalfDay' | 'halfDayType'>): string {
  const from = formatDate(l.fromDate.slice(0, 10));
  const to = formatDate(l.toDate.slice(0, 10));
  if (l.isHalfDay) return `${from} · ${l.halfDayType === 'SECOND_HALF' ? 'Second' : 'First'} half`;
  const days = `${l.totalDays} day${l.totalDays === 1 ? '' : 's'}`;
  return from === to ? `${from} · ${days}` : `${from} – ${to} · ${days}`;
}
