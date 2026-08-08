import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import {
  isLate,
  isEarlyExit,
  workingMinutes,
  weekdaysBetween,
} from "@/lib/attendance-config";
import { Card } from "@/components/ui/card";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

function toYmd(d: Date) {
  return d.toISOString().split("T")[0];
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; employeeId?: string; department?: string; preset?: string }>;
}) {
  const user = await getSessionUser();
  if (!user || user.role !== "super-admin") redirect("/dashboard");

  const sp = await searchParams;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let fromDate: Date;
  let toDate: Date;
  if (sp.preset === "week") {
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    fromDate = new Date(today);
    fromDate.setDate(today.getDate() + mondayOffset);
    toDate = today;
  } else if (sp.preset === "last-month") {
    fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    toDate = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (sp.from && sp.to) {
    fromDate = new Date(sp.from);
    toDate = new Date(sp.to);
  } else {
    fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
    toDate = today;
  }
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);

  const workingDays = weekdaysBetween(fromDate, toDate);

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(sp.employeeId ? { id: sp.employeeId } : {}),
      ...(sp.department ? { department: sp.department } : {}),
    },
    select: { id: true, name: true, department: true, employeeNumber: true },
    orderBy: { name: "asc" },
  });
  const employeeIds = employees.map((e) => e.id);
  const departments = Array.from(
    new Set(
      (await prisma.employee.findMany({
        where: { isActive: true },
        select: { department: true },
      }))
        .map((e) => e.department)
        .filter((d): d is string => !!d)
    )
  ).sort();

  const [records, leaves] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { employeeId: { in: employeeIds }, date: { gte: fromDate, lte: toDate } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: "APPROVED",
        fromDate: { lte: toDate },
        toDate: { gte: fromDate },
      },
    }),
  ]);

  type Row = {
    id: string;
    name: string;
    department: string | null;
    daysPresent: number;
    totalMinutes: number;
    lateCount: number;
    earlyExitCount: number;
    leaveDays: number;
    absences: number;
  };
  const rows: Row[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    department: e.department,
    daysPresent: 0,
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
    row.totalMinutes += workingMinutes(r.checkIn, r.checkOut);
    if (isLate(r.checkIn)) row.lateCount++;
    if (isEarlyExit(r.checkOut)) row.earlyExitCount++;
  }
  for (const l of leaves) {
    const row = byId.get(l.employeeId);
    if (!row) continue;
    const start = l.fromDate > fromDate ? l.fromDate : fromDate;
    const end = l.toDate < toDate ? l.toDate : toDate;
    const inRange = l.isHalfDay ? 0.5 : weekdaysBetween(start, end);
    row.leaveDays += inRange;
  }
  for (const r of rows) r.absences = Math.max(0, workingDays - r.daysPresent - r.leaveDays);

  const totalMinutes = rows.reduce((s, r) => s + r.totalMinutes, 0);
  const lateArrivals = rows.reduce((s, r) => s + r.lateCount, 0);
  const earlyExits = rows.reduce((s, r) => s + r.earlyExitCount, 0);
  const absences = rows.reduce((s, r) => s + r.absences, 0);
  const avgHoursPerEmp = rows.length && workingDays ? totalMinutes / 60 / (rows.length * workingDays) : 0;

  const csvHref = `/api/attendance/reports?format=csv&from=${toYmd(fromDate)}&to=${toYmd(toDate)}${sp.employeeId ? `&employeeId=${sp.employeeId}` : ""}${sp.department ? `&department=${encodeURIComponent(sp.department)}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-grey-900">Attendance Reports</h1>
          <p className="text-sm font-body text-grey-500">
            Working days exclude Saturdays and Sundays. Standard hours: 9:30 AM – 6:30 PM (IST).
          </p>
        </div>
        <a
          href={csvHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-body font-medium text-white hover:bg-primary/90"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input type="hidden" name="preset" value="custom" />
          <label className="flex flex-col gap-1 text-xs font-body font-medium text-grey-500">
            From
            <input
              type="date"
              name="from"
              defaultValue={toYmd(fromDate)}
              className="h-9 rounded-md border border-grey-200 px-2 text-sm text-grey-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-body font-medium text-grey-500">
            To
            <input
              type="date"
              name="to"
              defaultValue={toYmd(toDate)}
              className="h-9 rounded-md border border-grey-200 px-2 text-sm text-grey-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-body font-medium text-grey-500">
            Department
            <select
              name="department"
              defaultValue={sp.department || ""}
              className="h-9 rounded-md border border-grey-200 px-2 text-sm text-grey-900"
            >
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-body font-medium text-grey-500">
            Employee
            <select
              name="employeeId"
              defaultValue={sp.employeeId || ""}
              className="h-9 rounded-md border border-grey-200 px-2 text-sm text-grey-900"
            >
              <option value="">All</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="h-9 w-full rounded-md bg-primary text-sm font-body font-medium text-white hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        </form>
        <div className="mt-3 flex gap-2 text-xs">
          <a href="/attendance/reports?preset=week" className="rounded-full border border-grey-200 px-3 py-1 text-grey-600 hover:bg-grey-50">This Week</a>
          <a href="/attendance/reports" className="rounded-full border border-grey-200 px-3 py-1 text-grey-600 hover:bg-grey-50">This Month</a>
          <a href="/attendance/reports?preset=last-month" className="rounded-full border border-grey-200 px-3 py-1 text-grey-600 hover:bg-grey-50">Last Month</a>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <SummaryCard label="Working Days" value={workingDays.toString()} />
        <SummaryCard label="Total Hours" value={(totalMinutes / 60).toFixed(1)} />
        <SummaryCard label="Avg / Emp / Day" value={avgHoursPerEmp.toFixed(1)} />
        <SummaryCard label="Late Arrivals" value={lateArrivals.toString()} tone="warning" />
        <SummaryCard label="Early Exits" value={earlyExits.toString()} tone="warning" />
        <SummaryCard label="Absences" value={absences.toString()} tone="error" />
      </div>

      {/* Per-employee table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-light-600 text-left text-xs font-heading font-medium uppercase tracking-wider text-grey-500">
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Days Present</th>
                <th className="px-6 py-3">Total Hours</th>
                <th className="px-6 py-3">Avg / Day</th>
                <th className="px-6 py-3">Late</th>
                <th className="px-6 py-3">Early Exit</th>
                <th className="px-6 py-3">Leave</th>
                <th className="px-6 py-3">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-light-600/50">
                  <td className="px-6 py-3 text-sm font-body">
                    <p className="font-medium text-grey-900">{r.name}</p>
                    {r.department && <p className="text-xs text-grey-400">{r.department}</p>}
                  </td>
                  <td className="px-6 py-3 text-sm font-number text-grey-700">
                    {r.daysPresent} / {workingDays}
                  </td>
                  <td className="px-6 py-3 text-sm font-number text-grey-700">{(r.totalMinutes / 60).toFixed(1)}</td>
                  <td className="px-6 py-3 text-sm font-number text-grey-700">
                    {r.daysPresent > 0 ? (r.totalMinutes / 60 / r.daysPresent).toFixed(1) : "0.0"}
                  </td>
                  <td className="px-6 py-3 text-sm font-number text-grey-700">{r.lateCount}</td>
                  <td className="px-6 py-3 text-sm font-number text-grey-700">{r.earlyExitCount}</td>
                  <td className="px-6 py-3 text-sm font-number text-grey-700">{r.leaveDays}</td>
                  <td className="px-6 py-3 text-sm font-number text-error">{r.absences}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "warning" | "error" }) {
  const valueColor = tone === "error" ? "text-error" : tone === "warning" ? "text-orange-600" : "text-grey-900";
  return (
    <Card className="p-4">
      <p className="text-xs font-body text-grey-500">{label}</p>
      <p className={`mt-1 font-number text-2xl font-bold ${valueColor}`}>{value}</p>
    </Card>
  );
}
