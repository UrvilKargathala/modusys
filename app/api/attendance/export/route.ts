import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { formatTime, getWorkingHours } from "@/lib/attendance-utils";
import { istMidnight } from "@/lib/attendance-config";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const fromDate = istMidnight(from ?? new Date());
  // toDate is inclusive: bump to the *next* IST midnight so records dated on
  // `to` still match `lte`. Whole rows are @db.Date so 24h is one IST bucket.
  const toEndInclusive = istMidnight(to ?? new Date());
  toEndInclusive.setUTCDate(toEndInclusive.getUTCDate() + 1);

  const records = await prisma.attendanceRecord.findMany({
    where: { date: { gte: fromDate, lt: toEndInclusive } },
    include: {
      employee: {
        select: { name: true, email: true, department: true, employeeNumber: true },
      },
    },
    orderBy: [{ date: "asc" }, { checkIn: "asc" }],
  });

  const csvRows = [
    "Date,Employee,Email,Department,Employee No,Check In,Check Out,Working Hours,Door,Credential,Source",
  ];

  for (const r of records) {
    csvRows.push(
      [
        r.date.toISOString().split("T")[0],
        r.employee.name,
        r.employee.email || "",
        r.employee.department || "",
        r.employee.employeeNumber || "",
        formatTime(r.checkIn),
        formatTime(r.checkOut),
        getWorkingHours(r.checkIn, r.checkOut),
        r.doorName || "",
        r.credentialType || "",
        r.source,
      ].join(",")
    );
  }

  return new NextResponse(csvRows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=attendance-${fromDate.toISOString().split("T")[0]}-to-${(to ?? new Date().toISOString().slice(0, 10))}.csv`,
    },
  });
}
