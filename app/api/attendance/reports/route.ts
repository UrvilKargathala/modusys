import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import {
  isLate,
  isEarlyExit,
  workingMinutes,
  weekdaysBetween,
  istMidnight,
} from "@/lib/attendance-config";

export const dynamic = "force-dynamic";

// GET /api/attendance/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&employeeId=&department=&format=csv
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isSuper = user.role === "super-admin";
  // Non-super-admins get pinned to their own Employee. Any employeeId/
  // department query is ignored — this is the same rule the /attendance/
  // reports page enforces on the read side.
  let selfEmployeeId: string | undefined;
  if (!isSuper) {
    const { employee } = await getCurrentEmployee();
    if (!employee) return NextResponse.json({ error: "No linked employee record" }, { status: 403 });
    selfEmployeeId = employee.id;
  }

  const sp = req.nextUrl.searchParams;
  const fromStr = sp.get("from");
  const toStr = sp.get("to");
  const employeeIdParam = isSuper ? sp.get("employeeId") || undefined : selfEmployeeId;
  const departmentParam = isSuper ? sp.get("department") || undefined : undefined;
  const format = sp.get("format");

  const today = istMidnight();
  const fromDate = fromStr
    ? istMidnight(fromStr)
    : istMidnight(`${today.toISOString().slice(0, 7)}-01`);
  const toDate = toStr ? istMidnight(toStr) : today;

  const workingDays = weekdaysBetween(fromDate, toDate);

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(employeeIdParam ? { id: employeeIdParam } : {}),
      ...(departmentParam ? { department: departmentParam } : {}),
    },
    select: { id: true, name: true, department: true, employeeNumber: true },
    orderBy: { name: "asc" },
  });
  const employeeIds = employees.map((e) => e.id);

  const [records, leaves] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: fromDate, lte: toDate },
      },
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

  // Bucket by employee for aggregation.
  type Row = {
    employeeId: string;
    name: string;
    department: string | null;
    employeeNumber: string | null;
    daysPresent: number;
    totalMinutes: number;
    lateCount: number;
    earlyExitCount: number;
    leaveDays: number;
    absences: number;
  };
  const rows: Row[] = employees.map((e) => ({
    employeeId: e.id,
    name: e.name,
    department: e.department,
    employeeNumber: e.employeeNumber,
    daysPresent: 0,
    totalMinutes: 0,
    lateCount: 0,
    earlyExitCount: 0,
    leaveDays: 0,
    absences: 0,
  }));
  const byId = new Map(rows.map((r) => [r.employeeId, r]));

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
    // Only count leave days that fall inside the report window.
    const start = l.fromDate > fromDate ? l.fromDate : fromDate;
    const end = l.toDate < toDate ? l.toDate : toDate;
    const inRange = l.isHalfDay ? 0.5 : weekdaysBetween(start, end);
    row.leaveDays += inRange;
  }
  for (const row of rows) {
    row.absences = Math.max(0, workingDays - row.daysPresent - row.leaveDays);
  }

  const summary = {
    workingDays,
    totalHours: rows.reduce((s, r) => s + r.totalMinutes, 0) / 60,
    avgHoursPerEmployeePerDay:
      rows.length > 0 && workingDays > 0
        ? rows.reduce((s, r) => s + r.totalMinutes, 0) / 60 / (rows.length * workingDays)
        : 0,
    lateArrivals: rows.reduce((s, r) => s + r.lateCount, 0),
    earlyExits: rows.reduce((s, r) => s + r.earlyExitCount, 0),
    absences: rows.reduce((s, r) => s + r.absences, 0),
    onLeaveTotal: rows.reduce((s, r) => s + r.leaveDays, 0),
  };

  if (format === "csv") {
    const csv = [
      "Employee,Employee No,Department,Days Present,Working Days,Total Hours,Avg Hours/Day,Late,Early Exit,Leave Days,Absences",
      ...rows.map((r) =>
        [
          r.name,
          r.employeeNumber || "",
          r.department || "",
          r.daysPresent,
          workingDays,
          (r.totalMinutes / 60).toFixed(2),
          r.daysPresent > 0 ? (r.totalMinutes / 60 / r.daysPresent).toFixed(2) : "0.00",
          r.lateCount,
          r.earlyExitCount,
          r.leaveDays,
          r.absences,
        ]
          .map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : String(v)))
          .join(",")
      ),
    ].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-report-${fromDate.toISOString().split("T")[0]}-to-${toDate.toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({
    from: fromDate.toISOString().split("T")[0],
    to: toDate.toISOString().split("T")[0],
    summary,
    rows,
  });
}
