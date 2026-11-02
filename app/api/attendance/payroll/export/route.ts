import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/require-user";
import { getPayrollEmployees, loadPayroll } from "@/lib/server/payroll-data";
import { payrollRange } from "@/lib/payroll";

export const dynamic = "force-dynamic";

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const h = (m: number | null) => (m == null ? "" : (m / 60).toFixed(2));

// GET ?from=&to=&employeeId= (or an old ?view=&value=): the payroll report as CSV, same numbers as the dashboard.
export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const p = payrollRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, date: sp.get("date") ?? undefined, value: sp.get("value") ?? undefined });
  const period = p.month ?? `${p.from} to ${p.to}`;
  const rows = await loadPayroll(p.from, p.to, await getPayrollEmployees(sp.get("employeeId") || undefined));
  const head = ["Employee ID", "Name", "Period", "Scheduled Days", "Present Days", "Absent Days", "Leave Days", "Required Hours / Day", "Expected Hours", "Actual Hours", "Payable Hours", "Late Minutes", "Early Exit Minutes", "Overtime Hours", "Approved Overtime Hours", "Hourly Rate", "Expected Salary", "Earned Salary", "Overtime Pay", "Additions", "Deductions", "Final Payable", "Status"];
  const lines = rows.map(({ employee: e, summary: s, finalizedMonths }) => [
    e.employeeNumber ?? "", e.name, period, s.scheduledDays, s.presentDays, s.absentDays, s.leaveDays, h(s.requiredDailyMinutes), h(s.expectedMinutes), h(s.actualMinutes), h(s.payableMinutes),
    s.lateMinutes, s.earlyMinutes, h(s.overtimeMinutes), h(s.approvedOvertimeMinutes), s.hourlyRate != null ? s.hourlyRate.toFixed(2) : s.issues.includes("NO_RATE") ? "" : "Varies by month", s.expectedSalary ?? "", s.earnedSalary ?? "", s.overtimePay ?? "", s.additions, s.deductions, s.finalSalary ?? "",
    s.issues.length ? s.issues.map((i) => (i === "NO_RATE" ? "No hourly rate" : "No schedule")).join("; ") : finalizedMonths.length ? `Finalized ${finalizedMonths.join(", ")}` : "Live",
  ].map(csvCell).join(","));
  return new NextResponse([head.join(","), ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payroll-${p.from}_${p.to}.csv"` },
  });
}
