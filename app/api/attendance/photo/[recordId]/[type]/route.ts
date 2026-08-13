import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { getCurrentEmployee } from "@/lib/server/current-employee";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/attendance/photo/[recordId]/[type]
// recordId matches AttendanceRecord.id (unified check-in flow) OR
// PhotoAttendanceRecord.id (legacy selfie-only records). Try the unified
// table first, fall back to the legacy one so historical rows still resolve.
// Redirects to the blob URL if the caller is super-admin OR owns the record.
export async function GET(_req: Request, ctx: { params: Promise<{ recordId: string; type: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recordId, type } = await ctx.params;
  const side: "checkIn" | "checkOut" = type === "checkOut" ? "checkOut" : "checkIn";

  const attRecord = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
    select: { employeeId: true, checkInPhotoUrl: true, checkOutPhotoUrl: true },
  });

  const record =
    attRecord ??
    (await prisma.photoAttendanceRecord.findUnique({
      where: { id: recordId },
      select: { employeeId: true, checkInPhotoUrl: true, checkOutPhotoUrl: true },
    }));

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role !== "super-admin") {
    const { employee } = await getCurrentEmployee();
    if (!employee || employee.id !== record.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const url = side === "checkOut" ? record.checkOutPhotoUrl : record.checkInPhotoUrl;
  if (!url) return NextResponse.json({ error: "No photo on record" }, { status: 404 });
  return NextResponse.redirect(url, 302);
}
