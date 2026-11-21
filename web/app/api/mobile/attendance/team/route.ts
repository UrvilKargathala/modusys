import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { requireRole } from "@backend/server/require-user";
import { loadTeamDay } from "@backend/server/team-attendance";
import { istMidnight } from "@shared/attendance-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/mobile/attendance/team?date=YYYY-MM-DD → the website's Attendance page for that day (super admin only), from
// the same code (backend/server/team-attendance.ts), plus who hasn't checked in and who is on leave.
export async function GET(req: Request) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;
  const param = new URL(req.url).searchParams.get("date") ?? "";
  const date = istMidnight(DAY.test(param) ? param : new Date());
  const t = await loadTeamDay(date);
  const missingIds = t.managedIds.filter((id) => !t.presentEmployeeIds.has(id));
  const missing = missingIds.length
    ? await prisma.employee.findMany({ where: { id: { in: missingIds } }, select: { id: true, name: true, department: true }, orderBy: { name: "asc" } })
    : [];
  return NextResponse.json({
    date: date.toISOString().slice(0, 10),
    counts: {
      total: t.totalEmployees, present: t.present, onLeave: t.onLeaveCount, absent: t.absent, stillIn: t.stillIn,
      fullDays: t.fullDaysToday, halfDays: t.halfDaysToday, late: t.lateToday,
    },
    kpi: t.kpi,
    rows: t.allRows,
    notIn: missing.map((e) => ({ ...e, leaveType: t.onLeaveByEmployee.get(e.id) ?? null })),
  });
}
