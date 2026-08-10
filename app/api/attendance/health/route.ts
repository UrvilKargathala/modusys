import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { istMidnight, istParts } from "@/lib/attendance-config";

export const dynamic = "force-dynamic";

const STALE_HOURS = 4;
const WORK_HOUR_START = 9;   // 9 AM IST
const WORK_HOUR_END = 19;    // 7 PM IST

function isDuringWorkingHoursIST(now = new Date()) {
  const { hour, weekday } = istParts(now);
  if (weekday === 0 || weekday === 6) return false; // Sun / Sat
  return hour >= WORK_HOUR_START && hour < WORK_HOUR_END;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [lastUnifi, recordsToday] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      // A row with a UniFi-sourced check-in OR check-out counts as a webhook
      // event landing successfully.
      where: { OR: [{ checkInSource: "unifi" }, { checkOutSource: "unifi" }] },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, checkIn: true, checkOut: true },
    }),
    prisma.attendanceRecord.count({ where: { date: istMidnight() } }),
  ]);

  const lastWebhookAt = lastUnifi?.updatedAt ?? null;
  const hoursSinceLastWebhook = lastWebhookAt
    ? (Date.now() - lastWebhookAt.getTime()) / 3_600_000
    : null;

  const inWorkingHours = isDuringWorkingHoursIST();
  let isHealthy = true;
  let reason = "OK";
  if (inWorkingHours) {
    if (hoursSinceLastWebhook == null) {
      isHealthy = false;
      reason = "No events today";
    } else if (hoursSinceLastWebhook > STALE_HOURS) {
      isHealthy = false;
      reason = `No events in ${Math.floor(hoursSinceLastWebhook)} hours`;
    }
  }

  return NextResponse.json({
    lastWebhookAt: lastWebhookAt?.toISOString() ?? null,
    hoursSinceLastWebhook,
    recordsToday,
    isHealthy,
    reason,
  });
}
