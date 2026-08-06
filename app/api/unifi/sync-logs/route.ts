import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = body.days || 30;

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let page = 1;

    while (true) {
      const res = await fetch(
        `${process.env.UNIFI_HOST}/api/v1/developer/system/logs?page_num=${page}&page_size=100`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.UNIFI_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ topic: "door_openings" }),
        }
      );

      const json = await res.json();
      const hits = json?.data?.hits || [];

      if (hits.length === 0) break;

      for (const hit of hits) {
        const source = hit._source;
        if (!source?.actor?.id) continue;

        const actorId = source.actor.id;
        const published = source.event?.published;
        if (!published) continue;

        const timestamp = new Date(published);
        const today = new Date(timestamp);
        today.setHours(0, 0, 0, 0);

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        cutoff.setHours(0, 0, 0, 0);
        if (timestamp < cutoff) continue;

        const credentialType = source.authentication?.credential_provider || "UNKNOWN";

        let doorName = "Unknown Door";
        let doorId = "";
        if (Array.isArray(source.target)) {
          const doorTarget = source.target.find((t: any) => t.type === "door");
          if (doorTarget) {
            doorName = doorTarget.display_name || "Unknown Door";
            doorId = doorTarget.id || "";
          }
        }

        const employee = await prisma.employee.findFirst({
          where: { unifiUserId: actorId },
        });
        if (!employee) continue;

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
          totalCreated++;
        } else if (timestamp > existing.checkIn) {
          if (!existing.checkOut || timestamp > existing.checkOut) {
            await prisma.attendanceRecord.update({
              where: { id: existing.id },
              data: { checkOut: timestamp, checkOutDoorName: doorName },
            });
            totalUpdated++;
          }
        }

        totalProcessed++;
      }

      if (hits.length < 100) break;
      page++;
    }

    await prisma.unifiSyncLog.create({
      data: {
        syncType: "door_logs",
        status: "success",
        details: `Days: ${days}, Created: ${totalCreated}, Updated: ${totalUpdated}`,
        recordsProcessed: totalProcessed,
      },
    });

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      created: totalCreated,
      updated: totalUpdated,
    });
  } catch (error) {
    console.error("[Modusys] Log sync error:", error);
    return NextResponse.json({ error: "Sync failed", details: String(error) }, { status: 500 });
  }
}
