import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

// PATCH { recordId, approved }: approve or withdraw one day's overtime. Locked once that month is finalized.
export async function PATCH(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => null);
  const recordId = typeof b?.recordId === "string" ? b.recordId : "";
  if (typeof b?.approved !== "boolean") return NextResponse.json({ error: "approved must be true or false" }, { status: 400 });
  const r = await prisma.attendanceRecord.findUnique({ where: { id: recordId }, select: { id: true, employeeId: true, date: true } });
  if (!r) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
  const period = r.date.toISOString().slice(0, 7);
  if (await prisma.payrollPeriod.findUnique({ where: { employeeId_period: { employeeId: r.employeeId, period } }, select: { id: true } }))
    return NextResponse.json({ error: "This month is finalized. Reopen it to change overtime." }, { status: 409 });
  await prisma.attendanceRecord.update({ where: { id: recordId }, data: { overtimeApproved: b.approved } });
  void logAudit({ action: "OVERTIME_APPROVAL_CHANGED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "PAYROLL", id: recordId, label: `${r.date.toISOString().slice(0, 10)} ${b.approved ? "approved" : "withdrawn"}` }, req });
  return NextResponse.json({ ok: true });
}
