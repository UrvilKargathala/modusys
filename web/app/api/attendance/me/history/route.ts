import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { getCurrentEmployee } from "@backend/server/current-employee";
import { istDateString, istMidnight, weekdaysBetween } from "@shared/attendance-config";
import { withAttendancePhotos } from "@backend/server/serialize";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 93; // about three months: enough for the mobile history list

// GET /api/attendance/me/history?from=YYYY-MM-DD&to=YYYY-MM-DD
// The caller's own attendance days (newest first) and approved leaves in the range.
// Always pinned to the signed-in user's Employee, whatever their role: this is
// "My Attendance", not a team view. Defaults to the current IST month up to today.
export async function GET(req: NextRequest) {
  const { user, employee } = await getCurrentEmployee();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!employee) return NextResponse.json({ employee: null, records: [], leaves: [] });

  const sp = req.nextUrl.searchParams;
  const today = istDateString();
  const fromStr = sp.get("from") ?? `${today.slice(0, 7)}-01`;
  const toStr = sp.get("to") ?? today;
  if (!DAY.test(fromStr) || !DAY.test(toStr)) {
    return NextResponse.json({ error: "Use YYYY-MM-DD for from and to" }, { status: 400 });
  }
  const from = istMidnight(fromStr);
  const to = istMidnight(toStr);
  if (to < from) return NextResponse.json({ error: "to must not be before from" }, { status: 400 });
  if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_DAYS) {
    return NextResponse.json({ error: `At most ${MAX_DAYS} days at a time` }, { status: 400 });
  }

  const [records, leaves] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { employeeId: employee.id, date: { gte: from, lte: to } },
      orderBy: { date: "desc" },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: employee.id, status: "APPROVED", fromDate: { lte: to }, toDate: { gte: from } },
      select: { id: true, leaveType: true, customLeaveType: true, fromDate: true, toDate: true, isHalfDay: true, halfDayType: true },
      orderBy: { fromDate: "desc" },
    }),
  ]);

  // Same counting as GET /api/attendance/reports (which hides some names, so it
  // can't serve every user's own view): present = days with a record, leave =
  // approved leave weekdays inside the range, absent = the remaining weekdays.
  // Days after today are not counted (not absent yet).
  const todayDate = istMidnight(today);
  const countTo = to < todayDate ? to : todayDate;
  const workingDays = weekdaysBetween(from, countTo);
  const leaveDays = leaves.reduce((sum, l) => {
    const start = l.fromDate > from ? l.fromDate : from;
    const end = l.toDate < countTo ? l.toDate : countTo;
    if (start > end) return sum;
    return sum + (l.isHalfDay ? 0.5 : weekdaysBetween(start, end));
  }, 0);
  const summary = {
    workingDays,
    present: records.length,
    late: records.filter((r) => r.isLate).length,
    leave: leaveDays,
    absent: Math.max(0, workingDays - records.length - leaveDays),
  };

  return NextResponse.json({
    employee: { id: employee.id, name: employee.name },
    from: fromStr,
    to: toStr,
    summary,
    records: records.map(withAttendancePhotos),
    leaves,
  });
}
