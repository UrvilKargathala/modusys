// Modusys attendance rules. Times are IST wall-clock (Asia/Kolkata) —
// records are stored in UTC and interpreted per the row's `timezone` column
// when read (Modusys is India-only today, so this defaults to IST).
export const STANDARD_START = { hour: 9, minute: 30 };
export const STANDARD_END = { hour: 18, minute: 30 };
export const LATE_GRACE_MINUTES = 15; // late = check-in after 9:45 AM
export const BREAK_MINUTES = 60; // 1 hour lunch subtracted from working hours

export const LEAVE_TYPES = [
  { value: "SICK", label: "Sick" },
  { value: "CASUAL", label: "Casual" },
  { value: "ANNUAL", label: "Annual" },
  { value: "COMP_OFF", label: "Comp Off" },
  { value: "MATERNITY", label: "Maternity" },
  { value: "PATERNITY", label: "Paternity" },
  { value: "UNPAID", label: "Unpaid" },
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

export function isLate(checkIn: Date | null | undefined): boolean {
  if (!checkIn) return false;
  const { hour, minute } = istParts(checkIn);
  const mins = hour * 60 + minute;
  const cutoff = STANDARD_START.hour * 60 + STANDARD_START.minute + LATE_GRACE_MINUTES;
  return mins > cutoff;
}

export function isEarlyExit(checkOut: Date | null | undefined): boolean {
  if (!checkOut) return false;
  const { hour, minute } = istParts(checkOut);
  const mins = hour * 60 + minute;
  const cutoff = STANDARD_END.hour * 60 + STANDARD_END.minute;
  return mins < cutoff;
}

// Minutes actually worked = wall-clock duration − break. Never negative,
// never counted if there's no checkOut yet.
export function workingMinutes(checkIn: Date | null | undefined, checkOut: Date | null | undefined): number {
  if (!checkIn || !checkOut) return 0;
  const diff = Math.floor((checkOut.getTime() - checkIn.getTime()) / 60_000) - BREAK_MINUTES;
  return diff > 0 ? diff : 0;
}

export function isWeekend(d: Date): boolean {
  const { weekday } = istParts(d);
  return weekday === 0 || weekday === 6;
}

// Weekday count between two dates inclusive. Half-day handled by the caller
// (leave form multiplies by 0.5).
export function weekdaysBetween(from: Date, to: Date): number {
  if (from > to) return 0;
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    if (!isWeekend(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
