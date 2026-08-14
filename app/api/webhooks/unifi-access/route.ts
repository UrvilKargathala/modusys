import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

// UniFi door-tap webhook. Since the attendance system was unified around
// GPS+selfie, face scans no longer count as attendance — every event is
// stored in DoorAccessLog for security audit only. Nothing writes to
// AttendanceRecord from this endpoint anymore.
//
// Historical AttendanceRecord rows with checkInSource="unifi" stay in the
// DB as-is; only NEW webhook events are diverted.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnifiTarget = { type: string; id?: string; display_name?: string };

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("X-Webhook-Secret") !== process.env.UNIFI_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const src = payload._source;

    if (src?.event?.type !== "access.door.unlock") {
      return NextResponse.json({ ok: true });
    }

    const actorId = src.actor?.id;
    const actorName = src.actor?.display_name ?? null;
    if (!actorId) {
      return NextResponse.json({ ok: true, skipped: "no_actor" });
    }

    const timestamp = src.event?.published
      ? new Date(src.event.published)
      : new Date();
    const credentialType = src.authentication?.credential_provider || "UNKNOWN";

    const door = Array.isArray(src.target)
      ? (src.target as UnifiTarget[]).find((t) => t.type === "door")
      : null;
    const doorName = door?.display_name ?? null;
    const doorId = door?.id ?? null;

    // Look up the mapped employee, but keep going even if unmapped — a
    // door-tap by an unknown actor is still worth logging for security.
    const employee = await prisma.employee.findFirst({
      where: { unifiUserId: actorId },
      select: { id: true },
    });

    await prisma.doorAccessLog.create({
      data: {
        employeeId: employee?.id ?? null,
        unifiUserId: actorId,
        unifiUserName: actorName,
        doorName,
        doorId,
        credentialType,
        timestamp,
      },
    });

    return NextResponse.json({ ok: true, logged: true });
  } catch (error) {
    console.error("[Modusys] UniFi webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
