import { NextResponse } from "next/server";
import { requireRole } from "@backend/server/require-user";
import { getPayrollEmployees, loadPayroll } from "@backend/server/payroll-data";
import { istDateString } from "@shared/attendance-config";
import { monthRange, sumSummaries } from "@shared/payroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET /api/mobile/attendance/payroll?month=YYYY-MM → the website's Payroll page for one month (super admin): each employee's
// summary (finalized months read back frozen), the totals, and whether the month can be finalized yet. Same engine.
export async function GET(req: Request) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;
  const today = istDateString();
  const q = new URL(req.url).searchParams.get("month") ?? "";
  const month = MONTH.test(q) ? q : today.slice(0, 7);
  const { from, to } = monthRange(month);
  const rows = await loadPayroll(from, to, await getPayrollEmployees());
  return NextResponse.json({
    month,
    from,
    to,
    monthEnded: to < today,
    totals: sumSummaries(rows.map((r) => r.summary)),
    rows: rows.map((r) => ({
      employee: { id: r.employee.id, name: r.employee.name, employeeNumber: r.employee.employeeNumber ?? null },
      summary: r.summary,
      finalized: r.finalizedMonths.includes(month),
      openDays: r.days.filter((d) => d.status === "MISSING_CHECKOUT" || d.status === "INVALID").length,
    })),
  });
}
