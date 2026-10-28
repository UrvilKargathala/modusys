import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import { scheduledLateEarly } from "@/lib/server/payroll-data";
import { computeDayStatus, computeEarlyExitMinutes, computeLateMinutes, istDateString, istMidnight, workingMinutes } from "@/lib/attendance-config";

export const dynamic = "force-dynamic";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const body = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkIn: hhmm,
  checkOut: hhmm.or(z.literal("")),
  note: z.string().trim().max(300).optional(),
});
const at = (date: string, t: string) => new Date(`${date}T${t}:00+05:30`);

// PUT { employeeId, date, checkIn "HH:MM", checkOut "HH:MM" | "", note }: a super admin sets or fixes one day's times
// (IST), e.g. when someone forgot to check out. Creates the day if there was no check-in. Locked once the month is finalized.
export async function PUT(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid times" }, { status: 400 });
  const { employeeId, date, note } = parsed.data;
  if (date > istDateString()) return NextResponse.json({ error: "Times can't be set for a future day" }, { status: 400 });
  const checkIn = at(date, parsed.data.checkIn);
  const checkOut = parsed.data.checkOut ? at(date, parsed.data.checkOut) : null;
  if (checkOut && checkOut <= checkIn) return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (await prisma.payrollPeriod.findUnique({ where: { employeeId_period: { employeeId, period: date.slice(0, 7) } }, select: { id: true } }))
    return NextResponse.json({ error: "This month is finalized. Reopen it in Payroll to change times." }, { status: 409 });

  // Same stored flags check-in / check-out write, on the employee's own schedule (company default without one).
  const le = await scheduledLateEarly(employeeId, checkIn, checkOut);
  const late = le ? le.lateMinutes : computeLateMinutes(checkIn);
  const early = checkOut ? (le ? le.earlyMinutes : computeEarlyExitMinutes(checkOut)) : 0;
  const stamp = `Times set by ${me.name ?? me.email}${note ? `: ${note}` : ""}`;
  const day = istMidnight(date);
  const existing = await prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId, date: day } }, select: { id: true, checkIn: true, checkOut: true, notes: true } });
  const data = {
    checkIn,
    checkOut,
    workingMinutes: checkOut ? workingMinutes(checkIn, checkOut) : null,
    dayStatus: checkOut ? computeDayStatus(checkIn, checkOut) : null,
    isLate: late > 0,
    lateByMinutes: late > 0 ? late : null,
    isEarlyExit: early > 0,
    earlyExitByMinutes: early > 0 ? early : null,
    notes: existing?.notes ? `${existing.notes} · ${stamp}` : stamp,
    ...(existing?.checkIn.getTime() !== checkIn.getTime() ? { checkInSource: "manual" } : {}),
    ...(checkOut && existing?.checkOut?.getTime() !== checkOut.getTime() ? { checkOutSource: "manual" } : {}),
  };
  const record = existing
    ? await prisma.attendanceRecord.update({ where: { id: existing.id }, data })
    : await prisma.attendanceRecord.create({ data: { ...data, employeeId, date: day, source: "manual", checkInSource: "manual" } });

  void logAudit({
    action: "ATTENDANCE_EDITED",
    actor: { id: me.id, email: me.email, name: me.name },
    target: { type: "ATTENDANCE", id: record.id, label: `${employee.name} ${date}` },
    details: { before: existing ? { checkIn: existing.checkIn, checkOut: existing.checkOut } : null, checkIn: parsed.data.checkIn, checkOut: parsed.data.checkOut || null, note },
    req,
  });
  return NextResponse.json({ ok: true, id: record.id });
}
