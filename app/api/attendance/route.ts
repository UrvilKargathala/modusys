import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();
  date.setHours(0, 0, 0, 0);

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
