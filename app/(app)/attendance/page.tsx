import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { formatTime, getWorkingHours, formatDate } from "@/lib/attendance-utils";
import { SyncButtons } from "@/components/attendance/sync-buttons";
import { AutoRefresh } from "@/components/attendance/auto-refresh";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== "super-admin") redirect("/dashboard");

  const { date: dateParam } = await searchParams;
  const date = dateParam ? new Date(dateParam) : new Date();
  date.setHours(0, 0, 0, 0);

  const records = await prisma.attendanceRecord.findMany({
    where: { date },
    include: {
      employee: {
        select: { id: true, name: true, department: true, designation: true },
      },
    },
    orderBy: { checkIn: "desc" },
  });

  const totalEmployees = await prisma.employee.count({ where: { isActive: true } });
  const present = records.length;
  const absent = totalEmployees - present;
  const checkedOut = records.filter((r) => r.checkOut).length;
  const stillIn = present - checkedOut;

  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  const isToday = date.toDateString() === new Date().toDateString();
  const dateStr = date.toISOString().split("T")[0];

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-grey-900">Attendance</h1>
          <p className="text-sm font-body text-grey-500">UniFi Access door-based attendance tracking</p>
        </div>
        <SyncButtons />
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-3">
        <a
          href={`/attendance?date=${prevDate.toISOString().split("T")[0]}`}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-grey-200 hover:bg-grey-50 text-grey-600"
        >
          <ChevronLeft className="h-4 w-4" />
        </a>
        <span className="font-number text-base font-medium text-grey-900">
          {formatDate(date)}
          {isToday && (
            <Badge variant="outline" className="ml-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
              Today
            </Badge>
          )}
        </span>
        {!isToday && (
          <>
            <a
              href={`/attendance?date=${nextDate.toISOString().split("T")[0]}`}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-grey-200 hover:bg-grey-50 text-grey-600"
            >
              <ChevronRight className="h-4 w-4" />
            </a>
            <a
              href="/attendance"
              className="text-sm font-body font-medium text-primary hover:underline"
            >
              Today
            </a>
          </>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-sm font-body text-grey-500">Total Employees</p>
          <p className="font-number text-3xl font-bold text-grey-900 mt-1">{totalEmployees}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-body text-grey-500">Present</p>
          <p className="font-number text-3xl font-bold text-emerald-600 mt-1">{present}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-body text-grey-500">Absent</p>
          <p className="font-number text-3xl font-bold text-red-500 mt-1">{absent}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-body text-grey-500">Still In Office</p>
          <p className="font-number text-3xl font-bold text-blue-600 mt-1">{stillIn}</p>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-200 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-grey-900">Attendance Log</h2>
          <a
            href={`/api/attendance/export?from=${dateStr}&to=${dateStr}`}
            className="inline-flex items-center gap-1.5 text-sm font-body font-medium text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>

        {records.length === 0 ? (
          <div className="px-6 py-12 text-center font-body text-grey-400">
            No attendance records for this day
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-light-600 text-left text-xs font-heading font-medium text-grey-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Check In</th>
                  <th className="px-6 py-3">Check Out</th>
                  <th className="px-6 py-3">Working Hours</th>
                  <th className="px-6 py-3">Door</th>
                  <th className="px-6 py-3">Credential</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-100">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-light-600/50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-body font-medium text-grey-900">
                        {record.employee.name}
                      </p>
                      {record.employee.department && (
                        <p className="text-xs font-body text-grey-400">
                          {record.employee.department}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-number text-grey-700">
                      {formatTime(record.checkIn)}
                    </td>
                    <td className="px-6 py-4 text-sm font-number text-grey-700">
                      {formatTime(record.checkOut)}
                    </td>
                    <td className="px-6 py-4 text-sm font-number text-grey-700">
                      {getWorkingHours(record.checkIn, record.checkOut)}
                    </td>
                    <td className="px-6 py-4 text-sm font-number text-grey-500">
                      {record.doorName || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="text-xs">
                        {record.credentialType || "-"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {record.checkOut ? (
                        <Badge variant="outline" className="text-xs bg-grey-50 text-grey-600">
                          Left
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                          In Office
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
