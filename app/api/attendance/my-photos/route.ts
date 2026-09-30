import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getCurrentEmployee } from "@/lib/server/current-employee";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — every Photo Attendance photo owned by the caller.
export async function GET() {
  const { user, employee } = await getCurrentEmployee();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!employee) return NextResponse.json({ photos: [] });

  const rows = await prisma.photoAttendanceRecord.findMany({
    where: {
      employeeId: employee.id,
      OR: [{ checkInPhotoKey: { not: null } }, { checkOutPhotoKey: { not: null } }],
    },
    select: {
      id: true,
      date: true,
      checkIn: true,
      checkOut: true,
      checkInPhotoKey: true,
      checkOutPhotoKey: true,
    },
    orderBy: { date: "desc" },
  });

  const photos: Array<{ recordId: string; side: "checkIn" | "checkOut"; date: string; at: string }> = [];
  for (const r of rows) {
    if (r.checkInPhotoKey) {
      photos.push({ recordId: r.id, side: "checkIn", date: r.date.toISOString().slice(0, 10), at: r.checkIn.toISOString() });
    }
    if (r.checkOutPhotoKey && r.checkOut) {
      photos.push({ recordId: r.id, side: "checkOut", date: r.date.toISOString().slice(0, 10), at: r.checkOut.toISOString() });
    }
  }
  return NextResponse.json({ photos });
}
