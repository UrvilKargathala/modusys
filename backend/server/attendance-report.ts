import "server-only";
import { prisma } from "./prisma";
import { getManagedEmployeeIds } from "./managed-employees";
import { loadPayroll, payrollEmployeeSelect } from "./payroll-data";
import { workingMinutes, weekdaysBetween, istMidnight, istDateString, REPORT_HIDDEN_NAMES } from "@shared/attendance-config";

// Attendance report for a date range (the website's Attendance > Reports page and the phone's Reports view): one row per
// employee with days present, full / half days, hours, late / early counts, and leave and absence from the payroll
// engine (each employee's own weekly offs and holidays). Moved here from web/app/(app)/attendance/reports/page.tsx.

function toYmd(d: Date) {
  return d.toISOString().split("T")[0];
}

export type ReportQuery = { from?: string; to?: string; employeeId?: string; department?: string; preset?: string };

/** `selfEmployeeId`: set for non-super-admins (only their own row); null = super admin (everyone, filters apply). */
export async function loadAttendanceReport(sp: ReportQuery, selfEmployeeId: string | null) {
  const isSuper = selfEmployeeId === null;
  const selfEmployee = isSuper ? null : { id: selfEmployeeId };
  // All ranges expressed in the IST calendar so a Vercel (UTC) request lands
  // on the same day the user sees at their desk.
  const today = istMidnight();
  const todayYmd = istDateString();
  const [y, m, d] = todayYmd.split("-").map(Number);
  let fromDate: Date;
  let toDate: Date;
  if (sp.preset === "week") {
    // Monday-of-this-week in the IST calendar.
    const dayOfWeek = new Date(`${todayYmd}T00:00:00Z`).getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    fromDate = new Date(today);
    fromDate.setUTCDate(fromDate.getUTCDate() + mondayOffset);
    toDate = today;
  } else if (sp.preset === "last-month") {
    const prev = new Date(Date.UTC(y, m - 2, 1));
    const lastOfPrev = new Date(Date.UTC(y, m - 1, 0));
    fromDate = istMidnight(prev.toISOString().slice(0, 10));
    toDate = istMidnight(lastOfPrev.toISOString().slice(0, 10));
  } else if (sp.from && sp.to) {
    fromDate = istMidnight(sp.from);
    toDate = istMidnight(sp.to);
  } else {
    fromDate = istMidnight(`${y}-${String(m).padStart(2, "0")}-01`);
    toDate = today;
  }
  void d;

  const workingDays = weekdaysBetween(fromDate, toDate);

  const managedIds = await getManagedEmployeeIds();
  const employees = await prisma.employee.findMany({
    where: isSuper
      ? {
          isActive: true,
          name: { notIn: REPORT_HIDDEN_NAMES },
          id: { in: sp.employeeId ? managedIds.filter((id) => id === sp.employeeId) : managedIds },
          ...(sp.department ? { department: sp.department } : {}),
        }
      : { id: selfEmployee?.id ?? "__none__" },
    select: { id: true, name: true, department: true, employeeNumber: true },
    orderBy: { name: "asc" },
  });
  const employeeIds = employees.map((e) => e.id);
  const departments = isSuper
    ? Array.from(
        new Set(
          (await prisma.employee.findMany({
            where: { isActive: true, name: { notIn: REPORT_HIDDEN_NAMES }, id: { in: managedIds } },
            select: { department: true },
          }))
            .map((e) => e.department)
            .filter((d): d is string => !!d)
        )
      ).sort()
    : [];

  const records = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: fromDate, lte: toDate } },
  });

  type Row = {
    id: string;
    name: string;
    employeeNumber: string | null;
    department: string | null;
    daysPresent: number;
    workingDays: number;
    fullDays: number;
    halfDays: number;
    totalMinutes: number;
    lateCount: number;
    earlyExitCount: number;
    leaveDays: number;
    absences: number;
  };
  const rows: Row[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    employeeNumber: e.employeeNumber,
    department: e.department,
    daysPresent: 0,
    workingDays,
    fullDays: 0,
    halfDays: 0,
    totalMinutes: 0,
    lateCount: 0,
    earlyExitCount: 0,
    leaveDays: 0,
    absences: 0,
  }));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const r of records) {
    const row = byId.get(r.employeeId);
    if (!row) continue;
    row.daysPresent++;
    row.totalMinutes += r.workingMinutes ?? workingMinutes(r.checkIn, r.checkOut);
    if (r.dayStatus === "FULL_DAY") row.fullDays++;
    else if (r.dayStatus === "HALF_DAY") row.halfDays++;
    if (r.isLate) row.lateCount++;
    if (r.isEarlyExit) row.earlyExitCount++;
  }
  // Leave and absence from the payroll engine: each employee's own weekly offs and holidays, the same numbers as Payroll.
  // Late / early counts too, once the employee has a schedule (otherwise the stored company-policy flags stay).
  const pay = await loadPayroll(toYmd(fromDate), toYmd(toDate), await prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: payrollEmployeeSelect }));
  for (const p of pay) {
    const row = byId.get(p.employee.id);
    if (!row) continue;
    row.leaveDays = p.summary.leaveDays;
    row.absences = p.summary.absentDays;
    row.workingDays = p.summary.scheduledDays;
    row.totalMinutes = p.summary.actualMinutes;
    if (!p.summary.issues.includes("NO_SCHEDULE")) {
      row.lateCount = p.summary.lateDays;
      row.earlyExitCount = p.summary.earlyDays;
    }
  }

  const totalMinutes = rows.reduce((s, r) => s + r.totalMinutes, 0);
  const fullDays = rows.reduce((s, r) => s + r.fullDays, 0);
  const halfDays = rows.reduce((s, r) => s + r.halfDays, 0);
  const lateArrivals = rows.reduce((s, r) => s + r.lateCount, 0);
  const earlyExits = rows.reduce((s, r) => s + r.earlyExitCount, 0);
  const absences = rows.reduce((s, r) => s + r.absences, 0);
  const onLeaveTotal = rows.reduce((s, r) => s + r.leaveDays, 0);
  const scheduledTotal = rows.reduce((s, r) => s + r.workingDays, 0);
  const avgHoursPerEmp = scheduledTotal ? totalMinutes / 60 / scheduledTotal : 0;


  return {
    from: toYmd(fromDate), to: toYmd(toDate), fromDate, toDate, rows, departments, employees,
    totals: { totalMinutes, fullDays, halfDays, lateArrivals, earlyExits, absences, onLeaveTotal, scheduledTotal, avgHoursPerEmp },
  };
}
