import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { istMidnight } from "@/lib/attendance-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Today's Photo Attendance record for the caller. Reads from the isolated
// PhotoAttendanceRecord table so GPS check-ins never appear here.
export async function GET() {
  const { user, employee } = await getCurrentEmployee();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!employee) return NextResponse.json({ employee: null, today: null });

  const today = istMidnight();
  const record = await prisma.photoAttendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
      checkInNote: true,
      checkOutNote: true,
      checkInPhotoUrl: true,
      checkOutPhotoUrl: true,
    },
  });
  return NextResponse.json({ employee, today: record });
}
