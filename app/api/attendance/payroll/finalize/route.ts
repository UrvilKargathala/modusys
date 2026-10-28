import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import { getPayrollEmployees, loadPayroll } from "@/lib/server/payroll-data";
import { monthRange } from "@/lib/payroll";
import { istDateString } from "@/lib/attendance-config";

export const dynamic = "force-dynamic";

const periodOk = (p: unknown): p is string => typeof p === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

// POST { employeeId, period }: freeze one employee's month (totals + the rate used). Only a finished month with a rate and schedule.
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!periodOk(b?.period) || typeof b?.employeeId !== "string") return NextResponse.json({ error: "employeeId and period (YYYY-MM) are required" }, { status: 400 });
  const { from, to } = monthRange(b.period);
  if (to >= istDateString()) return NextResponse.json({ error: "A month can be finalized once it has ended" }, { status: 400 });
  const employees = await getPayrollEmployees(b.employeeId);
  if (!employees.length) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (await prisma.payrollPeriod.findUnique({ where: { employeeId_period: { employeeId: b.employeeId, period: b.period } }, select: { id: true } }))
    return NextResponse.json({ error: "This month is already finalized" }, { status: 409 });
  const [{ summary, days }] = await loadPayroll(from, to, employees);
  if (summary.issues.length) return NextResponse.json({ error: summary.issues.includes("NO_RATE") ? "Set an hourly rate before finalizing" : "Set a working schedule before finalizing" }, { status: 400 });
  const open = days.filter((d) => d.status === "MISSING_CHECKOUT" || d.status === "INVALID").length;
  if (open) return NextResponse.json({ error: `${open} day(s) have a missing or invalid check-out. Fix them before finalizing.` }, { status: 400 });
  await prisma.payrollPeriod.create({ data: { employeeId: b.employeeId, period: b.period, hourlyRate: summary.hourlyRate!, summary: summary as never, finalizedBy: me.name || me.email } });
  void logAudit({ action: "PAYROLL_FINALIZED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "PAYROLL", id: b.employeeId, label: `${employees[0].name} ${b.period}` }, req });
  return NextResponse.json({ ok: true });
}

// DELETE ?employeeId=&period=: reopen a finalized month (it is then calculated live again).
export async function DELETE(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const employeeId = sp.get("employeeId") ?? "";
  const period = sp.get("period");
  if (!periodOk(period)) return NextResponse.json({ error: "period (YYYY-MM) is required" }, { status: 400 });
  const p = await prisma.payrollPeriod.findUnique({ where: { employeeId_period: { employeeId, period } } });
  if (!p) return NextResponse.json({ error: "This month is not finalized" }, { status: 404 });
  await prisma.payrollPeriod.delete({ where: { id: p.id } });
  void logAudit({ action: "PAYROLL_REOPENED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "PAYROLL", id: employeeId, label: period }, req });
  return NextResponse.json({ ok: true });
}
