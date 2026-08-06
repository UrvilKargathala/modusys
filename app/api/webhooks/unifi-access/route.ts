import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("X-Webhook-Secret");
  if (secret !== process.env.UNIFI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const src = payload._source;

    if (src?.event?.type !== "access.door.unlock") {
      return NextResponse.json({ ok: true });
    }

    const actorId = src.actor?.id;
    const actorName = src.actor?.display_name;
    if (!actorId) {
      return NextResponse.json({ ok: true, skipped: "no_actor" });
    }

    const timestamp = src.event?.published
      ? new Date(src.event.published)
      : new Date();
    const credentialType = src.authentication?.credential_provider || "UNKNOWN";

    const door = Array.isArray(src.target)
      ? src.target.find((t: any) => t.type === "door")
      : null;
    const doorName = door?.display_name || "Unknown Door";
    const doorId = door?.id || null;

    const employee = await prisma.employee.findFirst({
      where: { unifiUserId: actorId },
    });

    if (!employee) {
      console.warn(`[Modusys] Unknown UniFi user: ${actorId} (${actorName})`);
      return NextResponse.json({ ok: true, skipped: "unmapped_user" });
    }

    const today = new Date(timestamp);
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: { employeeId: employee.id, date: today },
      },
    });

    if (!existing) {
      await prisma.attendanceRecord.create({
        data: {
          employeeId: employee.id,
          date: today,
          checkIn: timestamp,
          doorName,
          doorId,
          credentialType,
          source: "unifi",
        },
      });
    } else {
      await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { checkOut: timestamp, checkOutDoorName: doorName },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Modusys] Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
