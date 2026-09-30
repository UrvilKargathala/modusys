import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { deleteKey } from "@/lib/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Weekly Vercel Cron — deletes Photo Attendance photos older than 90 days.
// Drops the whole PhotoAttendanceRecord row (both photo URLs are its only
// reason to exist).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rows = await prisma.photoAttendanceRecord.findMany({
    where: { date: { lt: cutoff } },
    select: { id: true, checkInPhotoKey: true, checkOutPhotoKey: true },
  });

  let deletedBlobs = 0;
  for (const r of rows) {
    // Both sides of the record — a missed check-out photo would be orphaned once the row is gone.
    for (const key of [r.checkInPhotoKey, r.checkOutPhotoKey]) {
      if (!key) continue;
      try {
        await deleteKey(key);
        deletedBlobs++;
      } catch {
        /* keep going — the DB delete still runs */
      }
    }
    await prisma.photoAttendanceRecord.delete({ where: { id: r.id } });
  }

  console.log(`[Modusys] cron:cleanup-old-photos — freed ${deletedBlobs} blob(s), removed ${rows.length} row(s), cutoff=${cutoff.toISOString()}`);
  return NextResponse.json({ ok: true, deletedBlobs, rowsRemoved: rows.length, cutoff: cutoff.toISOString() });
}
