// Modusys Attendance Policy
// - Standard hours: 10:00 AM – 6:30 PM IST (8.5 hours)
// - No break deduction (working hours = checkOut − checkIn, wall-clock)
// - Late grace: 15 min (late = check-in AFTER 10:15 AM, informational only)
// - Half day threshold: < 4.5 hours worked
// - Full day: >= 4.5 hours worked
// - Applies to all sources: face scan (unifi), GPS + selfie (gps+photo),
//   and legacy gps/photo-only rows.
//
// Times are IST wall-clock (Asia/Kolkata). Timestamps are stored in UTC and
// interpreted per the row's `timezone` column when read (Modusys is
// India-only today, so this defaults to IST).
export const STANDARD_START = { hour: 10, minute: 0 };
export const STANDARD_END = { hour: 18, minute: 30 };
export const LATE_GRACE_MINUTES = 15; // late = check-in AFTER 10:15 AM (10:15 sharp is on time)
// No lunch break deduction — working hours = checkOut − checkIn directly.
export const HALF_DAY_THRESHOLD_MINUTES = 4.5 * 60; // < 4h30m worked = half day
export const TOTAL_WORK_MINUTES = 8.5 * 60;
export const ATTENDANCE_TIMEZONE = "Asia/Kolkata";

export type DayStatus = "IN_PROGRESS" | "HALF_DAY" | "FULL_DAY";

export const LEAVE_TYPES = [
  { value: "SICK", label: "Sick" },
  { value: "CASUAL", label: "Casual" },
  { value: "ANNUAL", label: "Annual" },
  { value: "COMP_OFF", label: "Comp Off" },
  { value: "MATERNITY", label: "Maternity" },
  { value: "PATERNITY", label: "Paternity" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "OTHER", label: "Other" },
] as const;

export type LeaveTypeValue = (typeof LEAVE_TYPES)[number]["value"];
export const LEAVE_TYPE_VALUES = LEAVE_TYPES.map((t) => t.value) as LeaveTypeValue[];
export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

// Convert a Date to IST wall-clock parts. Cheaper than pulling date-fns-tz —
// Intl.DateTimeFormat handles the offset+DST correctly for any zone.
export function istParts(d: Date): { hour: number; minute: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hour: Number(map.hour),
    minute: Number(map.minute),
    day: Number(map.day),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

// The IST calendar date (YYYY-MM-DD) of a given instant. Uses Intl so DST
// and offset are handled by the platform.
export function istDateString(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

// Canonical "day bucket" for AttendanceRecord.date and LeaveRequest.from/toDate.
// Returns a Date whose UTC value is 00:00 UTC of the IST calendar date, so
// Postgres @db.Date always stores the IST day regardless of where the code
// runs (UTC on Vercel, IST on a local dev Mac). Fixes the split-brain where
// setHours(0,0,0,0) captured the server's local midnight and stored two
// different dates for what humans think of as the same working day.
export function istMidnight(from: Date | string = new Date()): Date {
  return new Date(`${istDateString(from)}T00:00:00Z`);
}

// Late = checkIn STRICTLY after 10:15 AM IST. 10:15 sharp still counts as
// on time (the grace period includes 10:15). Purely informational — no
// salary deduction is tied to this flag.
export function isLate(checkIn: Date | null | undefined): boolean {
  return computeLateMinutes(checkIn) > 0;
}

// Minutes past 10:15 AM IST — 0 if on time or missing.
export function computeLateMinutes(checkIn: Date | null | undefined): number {
  if (!checkIn) return 0;
  const { hour, minute } = istParts(checkIn);
  const mins = hour * 60 + minute;
  const cutoff = STANDARD_START.hour * 60 + STANDARD_START.minute + LATE_GRACE_MINUTES;
  const diff = mins - cutoff;
  return diff > 0 ? diff : 0;
}

export function isEarlyExit(checkOut: Date | null | undefined): boolean {
  return computeEarlyExitMinutes(checkOut) > 0;
}

// Minutes before 6:30 PM IST — 0 if on/after 18:30 or missing.
export function computeEarlyExitMinutes(checkOut: Date | null | undefined): number {
  if (!checkOut) return 0;
  const { hour, minute } = istParts(checkOut);
  const mins = hour * 60 + minute;
  const cutoff = STANDARD_END.hour * 60 + STANDARD_END.minute;
  const diff = cutoff - mins;
  return diff > 0 ? diff : 0;
}

// Wall-clock minutes worked (checkOut − checkIn). NO break deduction.
// Never negative, never counted if there's no checkOut yet.
export function workingMinutes(checkIn: Date | null | undefined, checkOut: Date | null | undefined): number {
  if (!checkIn || !checkOut) return 0;
  const diff = Math.floor((checkOut.getTime() - checkIn.getTime()) / 60_000);
  return diff > 0 ? diff : 0;
}

// Day status derived purely from worked minutes.
// checkOut missing → IN_PROGRESS; < 4h30m → HALF_DAY; else FULL_DAY.
export function computeDayStatus(
  checkIn: Date | null | undefined,
  checkOut: Date | null | undefined
): DayStatus {
  if (!checkIn) return "IN_PROGRESS";
  if (!checkOut) return "IN_PROGRESS";
  const mins = workingMinutes(checkIn, checkOut);
  return mins < HALF_DAY_THRESHOLD_MINUTES ? "HALF_DAY" : "FULL_DAY";
}

export function formatWorkingHours(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function isWeekend(d: Date): boolean {
  const { weekday } = istParts(d);
  return weekday === 0 || weekday === 6;
}

// Weekday count between two dates inclusive. Half-day handled by the caller
// (leave form multiplies by 0.5). Walks in UTC on istMidnight-normalised
// dates so the loop is TZ-independent.
export function weekdaysBetween(from: Date, to: Date): number {
  const start = istMidnight(from);
  const end = istMidnight(to);
  if (start > end) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (!isWeekend(cur)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}
