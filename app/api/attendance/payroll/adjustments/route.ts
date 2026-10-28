import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import { adjustmentSchema } from "@/lib/employee-schema";

export const dynamic = "force-dynamic";

const isFinalized = (employeeId: string, period: string) => prisma.payrollPeriod.findUnique({ where: { employeeId_period: { employeeId, period } }, select: { id: true } });

// A salary addition or deduction for one employee and month. A finalized month is locked until it is reopened.
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = adjustmentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid adjustment" }, { status: 400 });
  const v = parsed.data;
  if (!(await prisma.employee.findUnique({ where: { id: v.employeeId }, select: { id: true } }))) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (await isFinalized(v.employeeId, v.period)) return NextResponse.json({ error: "This month is finalized. Reopen it to change adjustments." }, { status: 409 });
  const a = await prisma.salaryAdjustment.create({ data: { ...v, createdBy: me.name || me.email } });
  void logAudit({ action: "SALARY_ADJUSTMENT_CREATED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "PAYROLL", id: a.id, label: `${v.period} ${v.kind} ${v.amount}` }, req });
  return NextResponse.json({ id: a.id }, { status: 201 });
}

export async function DELETE(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const a = await prisma.salaryAdjustment.findUnique({ where: { id } });
  if (!a) return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
  if (await isFinalized(a.employeeId, a.period)) return NextResponse.json({ error: "This month is finalized. Reopen it to change adjustments." }, { status: 409 });
  await prisma.salaryAdjustment.delete({ where: { id } });
  void logAudit({ action: "SALARY_ADJUSTMENT_DELETED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "PAYROLL", id, label: `${a.period} ${a.kind} ${a.amount}` }, req });
  return NextResponse.json({ ok: true });
}
