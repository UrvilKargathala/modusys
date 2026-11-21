import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { requireRole } from "@backend/server/require-user";
import { getPayrollEmployees, loadPayroll, toPayrollEmployee } from "@backend/server/payroll-data";
import { istDateString } from "@shared/attendance-config";
import { WEEKDAYS, hoursText, scheduleOf, sumSummaries } from "@shared/payroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH = /^\d{4}-\d{2}$/;
const monthEnd = (m: string) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
};
const clock12 = (s: string | null) => {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// GET /api/mobile/attendance/calendar?employee=<id>&month=YYYY-MM → the website's Attendance calendar (month view) for one
// employee (super admin): every day from the payroll engine (status, counted / real times, hours, pay, place) and the
// month's totals, plus the employee list for the picker. Same code as the website page, so the numbers match Payroll.
export async function GET(req: Request) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;
  const q = new URL(req.url).searchParams;
  const month = MONTH.test(q.get("month") ?? "") ? q.get("month")! : istDateString().slice(0, 7);
  const all = await getPayrollEmployees();
  const selected = all.find((e) => e.id === q.get("employee")) ?? all[0];
  const employees = all.map((e) => {
    const pe = toPayrollEmployee(e);
    const sch = scheduleOf(pe);
    return {
      id: e.id,
      name: e.name,
      employeeNumber: e.employeeNumber ?? null,
      schedule: sch ? `${clock12(pe.scheduleStart)} – ${clock12(pe.scheduleEnd)} · ${hoursText(sch.required)} / day` : null,
      weeklyOff: pe.weeklyOffDays.map((d) => WEEKDAYS[d]),
    };
  });
  if (!selected) return NextResponse.json({ month, employees, employee: null, days: [], totals: null });

  const from = `${month}-01`;
  const to = monthEnd(month);
  const [pay, places, finalized] = await Promise.all([
    loadPayroll(from, to, [selected]),
    prisma.attendanceRecord.findMany({
      where: { employeeId: selected.id, date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
      select: { id: true, checkInAddress: true, checkOutAddress: true, doorName: true },
    }),
    prisma.payrollPeriod.findUnique({ where: { employeeId_period: { employeeId: selected.id, period: month } }, select: { id: true } }),
  ]);
  const placeOf = new Map(places.map((p) => [p.id, p]));
  const p = pay[0];
  return NextResponse.json({
    month,
    employees,
    employee: employees.find((e) => e.id === selected.id),
    finalized: !!finalized,
    days: (p?.days ?? []).map((d) => {
      const pl = d.recordId ? placeOf.get(d.recordId) : undefined;
      return { ...d, checkInAddress: pl?.checkInAddress ?? null, checkOutAddress: pl?.checkOutAddress ?? null, doorName: pl?.doorName ?? null };
    }),
    totals: sumSummaries(p ? [p.summary] : []),
  });
}
