import { NextResponse } from "next/server";
import { requireRole } from "@backend/server/require-user";
import { loadAttendanceReport } from "@backend/server/attendance-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/mobile/attendance/report?from=&to=&preset=week|last-month&employeeId=&department= → the website's Attendance >
// Reports page (super admin), from the same code (backend/server/attendance-report.ts).
export async function GET(req: Request) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;
  const q = new URL(req.url).searchParams;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  const preset = q.get("preset") ?? "";
  const r = await loadAttendanceReport(
    {
      from: DAY.test(from) ? from : undefined,
      to: DAY.test(to) ? to : undefined,
      preset: preset === "week" || preset === "last-month" ? preset : undefined,
      employeeId: q.get("employeeId") || undefined,
      department: q.get("department") || undefined,
    },
    null,
  );
  return NextResponse.json({ from: r.from, to: r.to, rows: r.rows, departments: r.departments, employees: r.employees, totals: r.totals });
}
