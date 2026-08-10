import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { formatTime, getWorkingHours, formatDate } from "@/lib/attendance-utils";
import { istMidnight } from "@/lib/attendance-config";
import { SyncButtons } from "@/components/attendance/sync-buttons";
import { AutoRefresh } from "@/components/attendance/auto-refresh";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Download, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; source?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== "super-admin") redirect("/dashboard");

  const { date: dateParam, source: sourceParam } = await searchParams;
  const date = istMidnight(dateParam ?? new Date());

  const sourceFilter = sourceParam === "gps" || sourceParam === "unifi" ? sourceParam : null;

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      fromDate: { lte: date },
      toDate: { gte: date },
    },
    select: { employeeId: true, leaveType: true },
  });
  const onLeaveByEmployee = new Map(approvedLeaves.map((l) => [l.employeeId, l.leaveType]));

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date,
      ...(sourceFilter ? { checkInSource: sourceFilter } : {}),
    },
    include: {
      employee: {
        select: { id: true, name: true, department: true, designation: true },
      },
    },
    orderBy: { checkIn: "desc" },
  });

  const totalEmployees = await prisma.employee.count({ where: { isActive: true } });
  const present = records.length;
  const presentEmployeeIds = new Set(records.map((r) => r.employeeId));
  const onLeaveCount = Array.from(onLeaveByEmployee.keys()).filter(
    (id) => !presentEmployeeIds.has(id)
  ).length;
  const absent = Math.max(0, totalEmployees - present - onLeaveCount);
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-5">
          <p className="text-sm font-body text-grey-500">Total Employees</p>
          <p className="font-number text-3xl font-bold text-grey-900 mt-1">{totalEmployees}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-body text-grey-500">Present</p>
          <p className="font-number text-3xl font-bold text-emerald-600 mt-1">{present}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-body text-grey-500">On Leave</p>
          <p className="font-number text-3xl font-bold text-amber-600 mt-1">{onLeaveCount}</p>
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
        <div className="px-6 py-4 border-b border-grey-200 flex items-center justify-between gap-4">
          <h2 className="font-heading text-base font-semibold text-grey-900">Attendance Log</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-md border border-grey-200 text-xs font-body">
              {(["all", "unifi", "gps"] as const).map((s) => {
                const active = (sourceFilter ?? "all") === s;
                const label = s === "all" ? "All" : s === "unifi" ? "Face Scan" : "GPS";
                const href = `/attendance?date=${dateStr}${s === "all" ? "" : `&source=${s}`}`;
                return (
                  <a
                    key={s}
                    href={href}
                    className={`px-3 py-1.5 ${active ? "bg-primary text-white" : "text-grey-600 hover:bg-grey-50"}`}
                  >
                    {label}
                  </a>
                );
              })}
            </div>
            <a
              href={`/api/attendance/export?from=${dateStr}&to=${dateStr}`}
              className="inline-flex items-center gap-1.5 text-sm font-body font-medium text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          </div>
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
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Door / Location</th>
                  <th className="px-6 py-3">Credential</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-100">
                {records.map((record) => {
                  const isGps = record.checkInSource === "gps";
                  const note = record.checkInNote || record.checkOutNote;
                  return (
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
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={`text-xs ${isGps ? "bg-primary-transparent text-primary border-primary/30" : "bg-grey-50 text-grey-700"}`}
                      >
                        {isGps ? "GPS" : "Face Scan"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm font-body text-grey-600">
                      {isGps && record.checkInLat != null && record.checkInLng != null ? (
                        <div className="flex flex-col gap-1">
                          <a
                            href={`https://www.google.com/maps?q=${record.checkInLat},${record.checkInLng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            title={record.checkInAddress || undefined}
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            {record.checkInAddress
                              ? record.checkInAddress.split(",").slice(0, 2).join(",")
                              : `${record.checkInLat.toFixed(4)}, ${record.checkInLng.toFixed(4)}`}
                          </a>
                          {note && (
                            <span className="text-xs italic text-grey-500" title={note}>
                              "{note.length > 40 ? note.slice(0, 40) + "…" : note}"
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="font-number text-grey-500">{record.doorName || "-"}</span>
                      )}
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
                );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
