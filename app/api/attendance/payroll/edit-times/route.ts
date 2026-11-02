import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// PATCH { recordId, editCheckIn?, editCheckOut? } (each "HH:MM" in IST, or "" / null to go back to the real time):
// the times Payroll counts for one day. The real check-in/out are never changed. Locked once that month is finalized.
export async function PATCH(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => null);
  const r = await prisma.attendanceRecord.findUnique({ where: { id: typeof b?.recordId === "string" ? b.recordId : "" } });
  if (!r) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
  const ymd = r.date.toISOString().slice(0, 10);
  if (await prisma.payrollPeriod.findUnique({ where: { employeeId_period: { employeeId: r.employeeId, period: ymd.slice(0, 7) } }, select: { id: true } }))
    return NextResponse.json({ error: "This month is finalized. Reopen it to change times." }, { status: 409 });

  const data: { editCheckIn?: Date | null; editCheckOut?: Date | null } = {};
  for (const k of ["editCheckIn", "editCheckOut"] as const) {
    if (!(k in b)) continue;
    const t = b[k];
    if (t === null || t === "") data[k] = null;
    else if (typeof t === "string" && HHMM.test(t)) data[k] = new Date(`${ymd}T${t}:00+05:30`);
    else return NextResponse.json({ error: "Enter a time like 09:30" }, { status: 400 });
  }
  const inT = data.editCheckIn === undefined ? r.editCheckIn ?? r.checkIn : data.editCheckIn ?? r.checkIn;
  const outT = data.editCheckOut === undefined ? r.editCheckOut ?? r.checkOut : data.editCheckOut ?? r.checkOut;
  if (outT && outT.getTime() <= inT.getTime()) return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });

  await prisma.attendanceRecord.update({ where: { id: r.id }, data });
  void logAudit({ action: "ATTENDANCE_EDIT_TIMES_CHANGED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "PAYROLL", id: r.id, label: ymd }, details: { editCheckIn: data.editCheckIn?.toISOString() ?? null, editCheckOut: data.editCheckOut?.toISOString() ?? null }, req });
  return NextResponse.json({ ok: true });
}
