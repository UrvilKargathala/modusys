import "server-only";
import { prisma } from "@/lib/server/prisma";
import { getManagedEmployeeIds } from "@/lib/server/managed-employees";
import { LEAVE_TYPES, REPORT_HIDDEN_NAMES, istDateString } from "@/lib/attendance-config";
import { computePayroll, lateEarly, monthRange, rateForMonth, monthsIn, sumSummaries, type PayrollDay, type PayrollEmployee, type PayrollSummary } from "@/lib/payroll";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v.toString()));

export const payrollEmployeeSelect = {
  id: true, name: true, employeeNumber: true, department: true, designation: true, email: true, phone: true, isActive: true,
  scheduleStart: true, scheduleEnd: true, requiredDailyMinutes: true, breakMinutes: true, lateGraceMinutes: true,
  weeklyOffDays: true, observesHolidays: true, hourlyRate: true, monthlySalary: true, overtimeEnabled: true, overtimeMultiplier: true, createdAt: true,
} as const;
type EmployeeRow = { id: string; name: string; employeeNumber: string | null; scheduleStart: string | null; scheduleEnd: string | null; requiredDailyMinutes: number | null; breakMinutes: number | null; lateGraceMinutes: number | null; weeklyOffDays: number[]; observesHolidays: boolean; hourlyRate: unknown; monthlySalary: unknown; overtimeEnabled: boolean; overtimeMultiplier: unknown };

// Until someone is given a schedule on the Employees page, the old company rule applies: Saturday and Sunday are off.
export function toPayrollEmployee(e: EmployeeRow): PayrollEmployee & { monthlySalary: number | null } {
  const weeklyOffDays = !e.scheduleStart && !e.weeklyOffDays.length ? [0, 6] : e.weeklyOffDays;
  return { ...e, weeklyOffDays, hourlyRate: num(e.hourlyRate as never), monthlySalary: num(e.monthlySalary as never), overtimeMultiplier: num(e.overtimeMultiplier as never) };
}

// Who payroll covers: everyone attendance covers (linked to a login) plus anyone given a schedule or rate on the Employees page,
// so a newly added employee shows up everywhere at once. Report-hidden people are left out unless they have a rate.
export async function getPayrollEmployees(onlyId?: string) {
  const managed = await getManagedEmployeeIds();
  const rows = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(onlyId ? { id: onlyId } : {}),
      OR: [{ id: { in: managed } }, { hourlyRate: { not: null } }, { monthlySalary: { not: null } }, { scheduleStart: { not: null } }],
    },
    select: payrollEmployeeSelect,
    orderBy: { name: "asc" },
  });
  return rows.filter((e) => e.hourlyRate != null || e.monthlySalary != null || !REPORT_HIDDEN_NAMES.includes(e.name));
}

export type EmployeePayroll = { employee: Awaited<ReturnType<typeof getPayrollEmployees>>[number]; days: PayrollDay[]; summary: PayrollSummary; finalizedMonths: string[] };

// Day rows and totals for each employee over [from, to]. A whole calendar month that has been finalized is read back frozen
// (its saved totals and rate), every other part is calculated live from attendance, schedule, rate and adjustments.
export async function loadPayroll(from: string, to: string, employees: Awaited<ReturnType<typeof getPayrollEmployees>>): Promise<EmployeePayroll[]> {
  const ids = employees.map((e) => e.id);
  const months = monthsIn(from, to);
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  const [records, leaves, holidays, adjustments, periods, firsts] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { employeeId: { in: ids }, date: { gte: fromDate, lte: toDate } }, select: { id: true, employeeId: true, date: true, checkIn: true, checkOut: true, overtimeApproved: true } }),
    prisma.leaveRequest.findMany({ where: { employeeId: { in: ids }, status: "APPROVED", fromDate: { lte: toDate }, toDate: { gte: fromDate } } }),
    // Whole months, so a salary's per-month rate counts every holiday in the month, not only those in the range.
    prisma.holiday.findMany({ where: { date: { gte: new Date(`${monthRange(months[0]).from}T00:00:00Z`), lte: new Date(`${monthRange(months[months.length - 1]).to}T00:00:00Z`) } } }),
    prisma.salaryAdjustment.findMany({ where: { employeeId: { in: ids }, period: { in: months } } }),
    prisma.payrollPeriod.findMany({ where: { employeeId: { in: ids }, period: { in: months } } }),
    prisma.attendanceRecord.groupBy({ by: ["employeeId"], where: { employeeId: { in: ids } }, _min: { date: true } }),
  ]);
  const hol = holidays.map((h) => ({ date: ymd(h.date), name: h.name }));
  return employees.map((emp) => {
    // Tracked from the day they were added or their first check-in, whichever is earlier: no absences before they joined.
    const first = firsts.find((f) => f.employeeId === emp.id)?._min.date;
    const added = istDateString(emp.createdAt);
    const pe = { ...toPayrollEmployee(emp), trackFrom: first && ymd(first) < added ? ymd(first) : added };
    const recs = records.filter((r) => r.employeeId === emp.id).map((r) => ({ id: r.id, date: ymd(r.date), checkIn: r.checkIn, checkOut: r.checkOut, overtimeApproved: r.overtimeApproved }));
    const lv = leaves.filter((l) => l.employeeId === emp.id).map((l) => ({
      from: ymd(l.fromDate), to: ymd(l.toDate), isHalfDay: l.isHalfDay,
      label: `${l.leaveType === "OTHER" && l.customLeaveType ? l.customLeaveType : (LEAVE_TYPES.find((t) => t.value === l.leaveType)?.label ?? l.leaveType)} leave${l.isHalfDay ? " (half)" : ""}`,
    }));
    const days: PayrollDay[] = [];
    const parts: PayrollSummary[] = [];
    const finalizedMonths: string[] = [];
    for (const m of months) {
      const mr = monthRange(m);
      const segFrom = mr.from < from ? from : mr.from;
      const segTo = mr.to > to ? to : mr.to;
      const adj = adjustments.filter((a) => a.employeeId === emp.id && a.period === m).map((a) => ({ kind: a.kind as "ADDITION" | "DEDUCTION", amount: Number(a.amount.toString()) }));
      const live = computePayroll({ ...pe, hourlyRate: rateForMonth(pe, m, hol) }, { from: segFrom, to: segTo, records: recs, leaves: lv, holidays: hol, adjustments: segFrom === mr.from && segTo === mr.to ? adj : [] });
      days.push(...live.days);
      const frozen = segFrom === mr.from && segTo === mr.to ? periods.find((p) => p.employeeId === emp.id && p.period === m) : undefined;
      if (frozen) {
        finalizedMonths.push(m);
        parts.push({ ...(frozen.summary as unknown as PayrollSummary), finalized: { at: frozen.finalizedAt.toISOString(), by: frozen.finalizedBy } });
      } else parts.push(live.summary);
    }
    const summary = parts.length === 1 ? parts[0] : sumSummaries(parts);
    return { employee: emp, days, summary, finalizedMonths };
  });
}

// Late / early minutes on this employee's own schedule, for check-in and check-out to store. Null when no schedule is set,
// so the caller falls back to the company default policy.
export async function scheduledLateEarly(employeeId: string, checkIn: Date | null, checkOut: Date | null) {
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: payrollEmployeeSelect });
  return e ? lateEarly(toPayrollEmployee(e), checkIn, checkOut) : null;
}
