import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { istMidnight } from "@/lib/attendance-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = istMidnight();

  const [lastUnifi, recordsToday] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: {
        // Any record where either edge came from a UniFi door tap.
        OR: [{ checkInSource: "unifi" }, { checkOutSource: "unifi" }],
      },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, checkIn: true, checkOut: true },
    }),
    prisma.attendanceRecord.count({ where: { date: today } }),
  ]);

  const lastWebhookAt = lastUnifi?.updatedAt ?? null;
  const hoursSinceLastWebhook = lastWebhookAt
    ? (Date.now() - lastWebhookAt.getTime()) / 3_600_000
    : null;

  return NextResponse.json({
    lastWebhookAt: lastWebhookAt?.toISOString() ?? null,
    recordsToday,
    hoursSinceLastWebhook,
  });
}
