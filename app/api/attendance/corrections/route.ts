import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { logAudit } from "@/lib/server/audit";
import { istDateString } from "@/lib/attendance-config";

export const dynamic = "force-dynamic";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal(""));
const body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkIn: hhmm,
  checkOut: hhmm,
  note: z.string().trim().min(3, "Say what happened").max(300),
});
const clock12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// POST { date, checkIn, checkOut, note }: an employee asks the super admins to fix a day's times (forgot to check out,
// wrong check-in). It arrives in their notifications and opens that day on the attendance calendar, where they set the times.
export async function POST(req: Request) {
  const { user, employee } = await getCurrentEmployee();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!employee) return NextResponse.json({ error: "Your account is not linked to an employee record." }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { date, checkIn, checkOut, note } = parsed.data;
  if (date > istDateString()) return NextResponse.json({ error: "Pick today or an earlier day" }, { status: 400 });
  if (!checkIn && !checkOut) return NextResponse.json({ error: "Enter the check-in or check-out time to set" }, { status: 400 });

  const times = [checkIn && `check-in ${clock12(checkIn)}`, checkOut && `check-out ${clock12(checkOut)}`].filter(Boolean).join(", ");
  const admins = await prisma.user.findMany({ where: { role: "super-admin" }, select: { id: true } });
  if (admins.length) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "attendance-correction",
        // The calendar day to open when the notification is clicked.
        relatedTaskId: `/attendance/calendar?view=day&date=${date}&employee=${employee.id}`,
        message: `${employee.name} asked to fix ${date.split("-").reverse().join("/")}: ${times}. "${note}"`,
      })),
    });
  }
  void logAudit({
    action: "ATTENDANCE_CORRECTION_REQUESTED",
    actor: { id: user.id, email: user.email, name: user.name },
    target: { type: "ATTENDANCE", id: employee.id, label: `${employee.name} ${date}` },
    details: { checkIn: checkIn || null, checkOut: checkOut || null, note },
    req,
  });
  return NextResponse.json({ ok: true });
}
