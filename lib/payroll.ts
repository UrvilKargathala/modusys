// Attendance + hourly salary, one engine for every screen (payroll dashboard, employee report, CSV, check-in/out).
// Everything comes from the employee's saved schedule and rate and the attendance timestamps; nothing is assumed.
//
// Per scheduled working day with a check-in and check-out (IST wall clock):
//   span     = check-out − check-in
//   break    = the employee's unpaid break, taken off when the span is longer than half the required day
//   actual   = span − break
//   late     = check-in − scheduled start, when that is more than the late grace (else 0)
//   early    = scheduled end − check-out, when positive
//   payable  = min(actual, required daily minutes)  — late / early time is simply not worked, so it is never deducted twice
//   overtime = actual − required daily minutes, when positive
// Work on a weekly off or holiday is all overtime (paid unless unticked on the report, when overtime is enabled).
// Expected minutes = scheduled working days in the period × required daily minutes (calendar based, no fixed 8 h, no "4 Sundays").
// Salary: expected = expected h × rate · earned = payable h × rate · overtime pay = approved OT h × rate × multiplier
//         final = earned + overtime pay + additions − deductions. No rate → no salary figures, a warning instead.
import { istDateString, istParts } from "@/lib/attendance-config";

export type PayrollEmployee = {
  id: string;
  name: string;
  employeeNumber: string | null;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  requiredDailyMinutes: number | null;
  breakMinutes: number | null;
  lateGraceMinutes: number | null;
  weeklyOffDays: number[];
  observesHolidays: boolean;
  hourlyRate: number | null;
  overtimeEnabled: boolean;
  overtimeMultiplier: number | null;
  // When set, each month's hourly rate is this ÷ (that month's working days × required hours); see rateForMonth.
  monthlySalary?: number | null;
  // First day this employee is tracked (YYYY-MM-DD). Earlier days are neither scheduled nor absent.
  trackFrom?: string | null;
};
export type PayrollRecord = { id: string; date: string; checkIn: Date; checkOut: Date | null; overtimeApproved: boolean };
export type PayrollLeave = { from: string; to: string; isHalfDay: boolean; label: string };
export type PayrollAdjustment = { kind: "ADDITION" | "DEDUCTION"; amount: number };

export type DayStatus = "PRESENT" | "IN_PROGRESS" | "MISSING_CHECKOUT" | "INVALID" | "LEAVE" | "ABSENT" | "OFF" | "OFF_WORKED" | "UPCOMING" | "BEFORE_START";
export type PayrollDay = {
  date: string;
  weekday: number;
  scheduled: boolean;
  offReason: "WEEKLY_OFF" | "HOLIDAY" | null;
  holidayName: string | null;
  status: DayStatus;
  leaveLabel: string | null;
  recordId: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  actualMinutes: number; // check-in to check-out, nothing taken off
  breakMinutes: number; // unpaid break taken off payable / overtime that day
  payableMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  overtimeApproved: boolean;
  // That day's pay (null without a schedule or rate): payable hours × rate, and approved overtime × rate × multiplier.
  // Not rounded, so the days add up exactly to the month's totals.
  rate: number | null;
  earned: number | null;
  overtimePay: number | null;
};
export type PayrollIssue = "NO_SCHEDULE" | "NO_RATE";
export type PayrollSummary = {
  scheduledDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  offDays: number;
  requiredDailyMinutes: number | null;
  expectedMinutes: number | null;
  actualMinutes: number;
  payableMinutes: number;
  lateMinutes: number;
  lateDays: number;
  earlyMinutes: number;
  earlyDays: number;
  overtimeMinutes: number;
  approvedOvertimeMinutes: number;
  hourlyRate: number | null;
  expectedSalary: number | null;
  earnedSalary: number | null;
  overtimePay: number | null;
  additions: number;
  deductions: number;
  finalSalary: number | null;
  issues: PayrollIssue[];
  // Set when these totals are a finalized month read back as frozen.
  finalized?: { at: string; by: string | null };
};

const DAY = 86_400_000;
const money = (n: number) => Math.round(n * 100) / 100;
// "HH:MM" -> minutes after midnight, or null when not a valid time.
export function parseClock(s: string | null | undefined): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((s ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export const istMinuteOfDay = (d: Date) => {
  const { hour, minute } = istParts(d);
  return hour * 60 + minute;
};
// All YYYY-MM-DD dates from `from` to `to` inclusive (UTC date arithmetic, no timezone drift).
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end; t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
const weekdayOf = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

export function scheduleOf(e: PayrollEmployee) {
  const start = parseClock(e.scheduleStart);
  const end = parseClock(e.scheduleEnd);
  const required = e.requiredDailyMinutes && e.requiredDailyMinutes > 0 ? e.requiredDailyMinutes : null;
  return start != null && end != null && end > start && required ? { start, end, required } : null;
}

// Late / early minutes for one check-in / check-out on the employee's schedule (used by check-in/out to store the day's flags).
export function lateEarly(e: PayrollEmployee, checkIn: Date | null, checkOut: Date | null): { lateMinutes: number; earlyMinutes: number } | null {
  const sch = scheduleOf(e);
  if (!sch) return null;
  const grace = Math.max(0, e.lateGraceMinutes ?? 0);
  const late = checkIn ? istMinuteOfDay(checkIn) - sch.start : 0;
  const early = checkOut ? sch.end - istMinuteOfDay(checkOut) : 0;
  return { lateMinutes: late > grace ? late : 0, earlyMinutes: early > 0 ? early : 0 };
}

export function computePayroll(
  e: PayrollEmployee,
  opts: { from: string; to: string; records: PayrollRecord[]; leaves: PayrollLeave[]; holidays: { date: string; name: string }[]; adjustments: PayrollAdjustment[]; today?: string },
): { days: PayrollDay[]; summary: PayrollSummary } {
  const today = opts.today ?? istDateString();
  const sch = scheduleOf(e);
  const rate = e.hourlyRate != null && e.hourlyRate > 0 ? e.hourlyRate : null;
  const multiplier = e.overtimeMultiplier != null && e.overtimeMultiplier > 0 ? e.overtimeMultiplier : 1;
  const issues: PayrollIssue[] = [];
  if (!sch) issues.push("NO_SCHEDULE");
  if (rate == null) issues.push("NO_RATE");
  const byDate = new Map(opts.records.map((r) => [r.date, r]));
  const holidayOn = new Map(opts.holidays.map((h) => [h.date, h.name]));
  const off = new Set(e.weeklyOffDays);
  const leaveOn = (d: string) => opts.leaves.find((l) => l.from <= d && l.to >= d) ?? null;

  const days: PayrollDay[] = [];
  const s = { scheduledDays: 0, presentDays: 0, absentDays: 0, leaveDays: 0, offDays: 0, actualMinutes: 0, payableMinutes: 0, lateMinutes: 0, lateDays: 0, earlyMinutes: 0, earlyDays: 0, overtimeMinutes: 0, approvedOvertimeMinutes: 0 };
  for (const date of eachDate(opts.from, opts.to)) {
    const weekday = weekdayOf(date);
    const holidayName = e.observesHolidays ? (holidayOn.get(date) ?? null) : null;
    const offReason = holidayName ? "HOLIDAY" : off.has(weekday) ? "WEEKLY_OFF" : null;
    const r = byDate.get(date) ?? null;
    const beforeStart = !r && !!e.trackFrom && date < e.trackFrom;
    const scheduled = !offReason && !beforeStart;
    const leave = scheduled ? leaveOn(date) : null;
    const day: PayrollDay = { date, weekday, scheduled, offReason, holidayName, status: "UPCOMING", leaveLabel: leave?.label ?? null, recordId: r?.id ?? null, checkIn: r?.checkIn ?? null, checkOut: r?.checkOut ?? null, actualMinutes: 0, breakMinutes: 0, payableMinutes: 0, lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, overtimeApproved: r?.overtimeApproved ?? false, rate: null, earned: null, overtimePay: null };
    if (scheduled) s.scheduledDays++;
    else if (!beforeStart) s.offDays++;

    if (r && r.checkOut && r.checkOut.getTime() <= r.checkIn.getTime()) {
      day.status = "INVALID"; // check-out not after check-in: never paid, shown for correction
    } else if (r && !r.checkOut) {
      day.status = date === today ? "IN_PROGRESS" : "MISSING_CHECKOUT";
      if (scheduled && sch) {
        const le = lateEarly(e, r.checkIn, null)!;
        day.lateMinutes = le.lateMinutes;
      }
    } else if (r && r.checkOut) {
      // Actual is the plain check-in to check-out time. The unpaid break only comes off what is paid (payable and overtime).
      const span = Math.floor((r.checkOut.getTime() - r.checkIn.getTime()) / 60_000);
      const brk = Math.max(0, e.breakMinutes ?? 0);
      const deduct = brk > 0 && span > (sch ? sch.required / 2 : brk) ? Math.min(brk, span) : 0;
      const net = Math.max(0, span - deduct);
      day.actualMinutes = Math.max(0, span);
      day.breakMinutes = deduct;
      if (scheduled) {
        day.status = "PRESENT";
        if (sch) {
          const le = lateEarly(e, r.checkIn, r.checkOut)!;
          day.lateMinutes = le.lateMinutes;
          day.earlyMinutes = le.earlyMinutes;
          day.payableMinutes = Math.min(net, sch.required);
          day.overtimeMinutes = Math.max(0, net - sch.required);
        }
      } else {
        day.status = "OFF_WORKED";
        day.overtimeMinutes = net;
      }
    } else if (beforeStart) {
      day.status = "BEFORE_START";
    } else if (!scheduled) {
      day.status = "OFF";
    } else if (leave) {
      day.status = "LEAVE";
    } else {
      day.status = date > today ? "UPCOMING" : "ABSENT";
    }

    if (day.status === "PRESENT" || day.status === "IN_PROGRESS" || day.status === "MISSING_CHECKOUT" || day.status === "INVALID") if (scheduled) s.presentDays++;
    if (day.status === "ABSENT") s.absentDays++;
    if (day.status === "LEAVE") s.leaveDays += leave?.isHalfDay ? 0.5 : 1;
    // A half-day leave on a day with a check-in still counts the half.
    if (r && leave?.isHalfDay) s.leaveDays += 0.5;
    s.actualMinutes += day.actualMinutes;
    s.payableMinutes += day.payableMinutes;
    s.lateMinutes += day.lateMinutes;
    if (day.lateMinutes > 0) s.lateDays++;
    s.earlyMinutes += day.earlyMinutes;
    if (day.earlyMinutes > 0) s.earlyDays++;
    s.overtimeMinutes += day.overtimeMinutes;
    if (day.overtimeApproved) s.approvedOvertimeMinutes += day.overtimeMinutes;
    const paid = rate != null && sch != null;
    day.rate = paid ? rate : null;
    day.earned = paid ? (day.payableMinutes / 60) * rate! : null;
    day.overtimePay = paid ? (e.overtimeEnabled && day.overtimeApproved ? (day.overtimeMinutes / 60) * rate! * multiplier : 0) : null;
    days.push(day);
  }

  const additions = money(opts.adjustments.filter((a) => a.kind === "ADDITION").reduce((n, a) => n + a.amount, 0));
  const deductions = money(opts.adjustments.filter((a) => a.kind === "DEDUCTION").reduce((n, a) => n + a.amount, 0));
  const expectedMinutes = sch ? s.scheduledDays * sch.required : null;
  const earnedSalary = rate != null && sch ? money((s.payableMinutes / 60) * rate) : null;
  const overtimePay = rate != null && sch ? (e.overtimeEnabled ? money((s.approvedOvertimeMinutes / 60) * rate * multiplier) : 0) : null;
  return {
    days,
    summary: {
      ...s,
      requiredDailyMinutes: sch?.required ?? null,
      expectedMinutes,
      hourlyRate: rate,
      expectedSalary: rate != null && expectedMinutes != null ? money((expectedMinutes / 60) * rate) : null,
      earnedSalary,
      overtimePay,
      additions,
      deductions,
      finalSalary: earnedSalary != null && overtimePay != null ? money(earnedSalary + overtimePay + additions - deductions) : null,
      issues,
    },
  };
}

// Adds month (or any period) totals together for a yearly view or the workforce total. Salary stays null if any part is null.
// Working days in one calendar month on this employee's schedule: weekly offs and the holidays they observe are left out
// (e.g. 27 in October 2026 with Sunday off, 26 with one holiday).
export function workingDaysInMonth(e: PayrollEmployee, period: string, holidays: { date: string }[]): number {
  const { from, to } = monthRange(period);
  const off = new Set(e.weeklyOffDays);
  const hol = new Set(e.observesHolidays ? holidays.map((h) => h.date) : []);
  return eachDate(from, to).filter((d) => !off.has(weekdayOf(d)) && !hol.has(d)).length;
}

// The hourly rate for a month: from the monthly salary when one is set, so a full month's attendance pays exactly the salary;
// otherwise the fixed hourly rate.
export function rateForMonth(e: PayrollEmployee, period: string, holidays: { date: string }[]): number | null {
  if (e.monthlySalary == null || e.monthlySalary <= 0) return e.hourlyRate;
  const sch = scheduleOf(e);
  const days = workingDaysInMonth(e, period, holidays);
  return sch && days ? e.monthlySalary / ((days * sch.required) / 60) : null;
}

export function sumSummaries(list: PayrollSummary[]): PayrollSummary {
  const add = (k: keyof PayrollSummary) => list.reduce((n, x) => n + (Number(x[k]) || 0), 0);
  const addNullable = (k: "expectedMinutes" | "expectedSalary" | "earnedSalary" | "overtimePay" | "finalSalary") => (list.some((x) => x[k] == null) ? null : money(list.reduce((n, x) => n + (x[k] as number), 0)));
  const rates = [...new Set(list.map((x) => x.hourlyRate))];
  const daily = [...new Set(list.map((x) => x.requiredDailyMinutes))];
  return {
    scheduledDays: add("scheduledDays"), presentDays: add("presentDays"), absentDays: add("absentDays"), leaveDays: add("leaveDays"), offDays: add("offDays"),
    requiredDailyMinutes: daily.length === 1 ? daily[0] : null,
    expectedMinutes: addNullable("expectedMinutes"),
    actualMinutes: add("actualMinutes"), payableMinutes: add("payableMinutes"), lateMinutes: add("lateMinutes"), lateDays: add("lateDays"), earlyMinutes: add("earlyMinutes"), earlyDays: add("earlyDays"),
    overtimeMinutes: add("overtimeMinutes"), approvedOvertimeMinutes: add("approvedOvertimeMinutes"),
    hourlyRate: rates.length === 1 ? rates[0] : null,
    expectedSalary: addNullable("expectedSalary"), earnedSalary: addNullable("earnedSalary"), overtimePay: addNullable("overtimePay"),
    additions: money(add("additions")), deductions: money(add("deductions")), finalSalary: addNullable("finalSalary"),
    issues: [...new Set(list.flatMap((x) => x.issues))],
  };
}

// The calendar months a range touches, as YYYY-MM.
export function monthsIn(from: string, to: string): string[] {
  const out: string[] = [];
  for (let [y, m] = from.slice(0, 7).split("-").map(Number); `${y}-${String(m).padStart(2, "0")}` <= to.slice(0, 7); m === 12 ? ((m = 1), y++) : m++) out.push(`${y}-${String(m).padStart(2, "0")}`);
  return out;
}
export function monthRange(period: string): { from: string; to: string } {
  const [y, m] = period.split("-").map(Number);
  return { from: `${period}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

// The payroll dashboard's period: a day (YYYY-MM-DD), a month (YYYY-MM) or a year (YYYY). Bad input falls back to the current one.
export type PayrollView = "day" | "month" | "year";
export function periodRange(view: string | undefined, value: string | undefined, today = istDateString()): { view: PayrollView; value: string; from: string; to: string } {
  if (view === "day") {
    const v = /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : today;
    return { view, value: v, from: v, to: v };
  }
  if (view === "year") {
    const v = /^\d{4}$/.test(value ?? "") ? value! : today.slice(0, 4);
    return { view, value: v, from: `${v}-01-01`, to: `${v}-12-31` };
  }
  const v = /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "") ? value! : today.slice(0, 7);
  return { view: "month", value: v, ...monthRange(v) };
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const hoursText = (mins: number | null | undefined) => (mins == null ? "—" : `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, "0")}m`);
