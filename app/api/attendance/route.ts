import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { istMidnight } from "@/lib/attendance-config";

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const date = istMidnight(dateParam ?? new Date());

  const records = await prisma.attendanceRecord.findMany({
    where: { date },
    include: {
      employee: {
        select: { id: true, name: true, department: true, designation: true, employeeNumber: true },
      },
    },
    orderBy: { checkIn: "asc" },
  });

  const totalEmployees = await prisma.employee.count({ where: { isActive: true } });
  const present = records.length;
  const absent = totalEmployees - present;
  const checkedOut = records.filter((r) => r.checkOut).length;
  const stillIn = present - checkedOut;

  return NextResponse.json({
    date: date.toISOString(),
    summary: { totalEmployees, present, absent, checkedOut, stillIn },
    records,
  });
}
