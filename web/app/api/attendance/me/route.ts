import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { getCurrentEmployee } from "@backend/server/current-employee";
import { istMidnight } from "@shared/attendance-config";
import { withAttendancePhotos } from "@backend/server/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, employee } = await getCurrentEmployee();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!employee) {
    return NextResponse.json({ employee: null, today: null }, { status: 200 });
  }

  const today = istMidnight();

  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
  });

  return NextResponse.json({ employee, today: record ? withAttendancePhotos(record) : null });
}
