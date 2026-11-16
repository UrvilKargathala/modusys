// Attendance labels copied from the web (~/modusys/lib/attendance-config.ts and
// lib/server/payroll-data.ts). Keep in sync with the web.
import type { AttendanceRecord, Leave } from '../api/attendance';
import { formatDay } from './format';

export const LEAVE_TYPES = [
  { value: 'SICK', label: 'Sick' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'COMP_OFF', label: 'Comp Off' },
  { value: 'MATERNITY', label: 'Maternity' },
  { value: 'PATERNITY', label: 'Paternity' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'OTHER', label: 'Other' },
] as const;

/** "Sick leave", "Casual leave (half)", or the custom name for OTHER: same as the web. */
export function leaveLabel(l: Pick<Leave, 'leaveType' | 'customLeaveType' | 'isHalfDay'>): string {
  const name =
    l.leaveType === 'OTHER' && l.customLeaveType
      ? l.customLeaveType
      : (LEAVE_TYPES.find((t) => t.value === l.leaveType)?.label ?? l.leaveType);
  return `${name} leave${l.isHalfDay ? ' (half)' : ''}`;
}

/** "Mon, 10/11/2026" or "Mon, 10/11/2026 – Wed, 12/11/2026" */
export function leaveDates(l: Pick<Leave, 'fromDate' | 'toDate'>): string {
  const from = formatDay(l.fromDate);
  const to = formatDay(l.toDate);
  return from === to ? from : `${from} – ${to}`;
}

export type TodayState = 'not-checked-in' | 'checked-in' | 'checked-out';

export function todayState(today: AttendanceRecord | null): TodayState {
  if (!today) return 'not-checked-in';
  return today.checkOut ? 'checked-out' : 'checked-in';
}

/** Badge key for a past or current day. A past day without check-out is flagged, like the web calendar. */
export function dayBadge(r: AttendanceRecord, isToday: boolean): 'FULL_DAY' | 'HALF_DAY' | 'IN_PROGRESS' | 'no-checkout' {
  if (!r.checkOut) return isToday ? 'IN_PROGRESS' : 'no-checkout';
  return r.dayStatus === 'HALF_DAY' ? 'HALF_DAY' : r.dayStatus === 'FULL_DAY' ? 'FULL_DAY' : 'IN_PROGRESS';
}

/** Minutes since check-in, for "hours so far" on an open day. */
export function minutesSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
}
