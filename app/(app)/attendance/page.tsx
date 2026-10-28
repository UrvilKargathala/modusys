import { getManagedEmployeeIds } from "@/lib/server/managed-employees";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { formatTime, getWorkingHours, formatDate } from "@/lib/attendance-utils";
import { istMidnight, workingMinutes } from "@/lib/attendance-config";
import { SyncButtons } from "@/components/attendance/sync-buttons";
import { AutoRefresh } from "@/components/attendance/auto-refresh";
import { AttendanceHealthBanner } from "@/components/attendance/health-banner";
import { AdminPhotoThumb } from "@/components/attendance/admin-photo-thumb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  CalendarCheck,
  UserCheck,
  Clock,
  TimerOff,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
  ChevronRight,
  Download,
  MapPin,
} from "lucide-react";
import { withAttendancePhotos } from "@/lib/server/serialize";

// The table only needs to know whether each side has a photo; it renders via /api/files/att_<id>.
const photoFlags = (r: Parameters<typeof withAttendancePhotos>[0]) => {
  const { checkInPhotoUrl, checkOutPhotoUrl } = withAttendancePhotos(r);
  return { checkInPhotoUrl, checkOutPhotoUrl };
};

// Unified row across AttendanceRecord (unifi face-scan + new remote gps+photo
// check-ins) and legacy PhotoAttendanceRecord (selfie-only records from
// before the merge). Legacy "gps"-only and "photo"-only rows still render as
// "Remote Check-in" for a consistent UI, even though the underlying data is
// partial.
type Row = {
  id: string;
  // "unifi" = face scan at door, "remote" = anything staff-initiated (gps,
  // photo, or the new combined gps+photo). Keeping the internal distinction
  // in checkInSource means historical inspection is still possible in the DB,
  // but the UI only exposes two categories.
  source: "unifi" | "remote";
  employee: { id: string; name: string; department: string | null };
  checkIn: Date;
  checkOut: Date | null;
  doorName: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAddress: string | null;
  credentialType: string | null;
  note: string | null;
  // The id used by the photo broker (/api/files/att_<id>?side=).
  // For AttendanceRecord rows it's the record's own id; for legacy
  // PhotoAttendanceRecord rows it's that record's id — the broker tries both
  // tables in order so either resolves correctly.
  photoRecordId: string | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  workingMinutes: number | null;
  dayStatus: string | null;
  isLate: boolean;
  lateByMinutes: number | null;
  isEarlyExit: boolean;
  earlyExitByMinutes: number | null;
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; source?: string; page?: string; stat?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/sign-in");
  if (sessionUser.role !== "super-admin") redirect("/my-attendance");

  const { date: dateParam, source: sourceParam, page: pageParam, stat: statParam } = await searchParams;
  const date = istMidnight(dateParam ?? new Date());

  const sourceFilter =
    sourceParam === "unifi" || sourceParam === "remote" ? sourceParam : null;
  // Which pill filter is active — clicking a stat pill sets ?stat=... and
  // narrows the attendance log to only matching rows. Ignored if unrecognised.
  const statFilter = ["full", "half", "late", "in-office"].includes(statParam ?? "")
    ? (statParam as "full" | "half" | "late" | "in-office")
    : null;
  const pageIdx = Math.max(0, Number(pageParam) - 1 || 0);

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      fromDate: { lte: date },
      toDate: { gte: date },
    },
    select: { employeeId: true, leaveType: true },
  });
  const onLeaveByEmployee = new Map(approvedLeaves.map((l) => [l.employeeId, l.leaveType]));

  const managedIds = await getManagedEmployeeIds();

  // Fetch both tables in parallel — filter by source at merge time.
  const [attRecords, photoRecords] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { date, employeeId: { in: managedIds } },
      include: {
        employee: {
          select: { id: true, name: true, department: true, designation: true },
        },
      },
      orderBy: { checkIn: "desc" },
    }),
    prisma.photoAttendanceRecord.findMany({
      where: { date, employeeId: { in: managedIds } },
      orderBy: { checkIn: "desc" },
    }),
  ]);

  // PhotoAttendanceRecord has no schema-level Employee relation — hydrate
  // employee data with one extra query keyed on the ids we saw.
  const photoEmployeeIds = Array.from(new Set(photoRecords.map((r) => r.employeeId)));
  const photoEmployees = photoEmployeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: photoEmployeeIds } },
        select: { id: true, name: true, department: true },
      })
    : [];
  const photoEmpById = new Map(photoEmployees.map((e) => [e.id, e]));

  const allRows: Row[] = [
    ...attRecords.map((r): Row => ({
      id: r.id,
      // Only true face-scan door taps count as "unifi" — everything else
      // (legacy "gps", legacy "manual", new "gps+photo") is a staff-initiated
      // remote check-in.
      source: r.checkInSource === "unifi" ? "unifi" : "remote",
      employee: r.employee,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      doorName: r.doorName,
      checkInLat: r.checkInLat,
      checkInLng: r.checkInLng,
      checkInAddress: r.checkInAddress,
      credentialType: r.credentialType,
      note: r.checkInNote || r.checkOutNote,
      photoRecordId: r.checkInPhotoKey || r.checkOutPhotoKey ? r.id : null,
      ...photoFlags(r),
      workingMinutes: r.workingMinutes,
      dayStatus: r.dayStatus,
      isLate: r.isLate,
      lateByMinutes: r.lateByMinutes,
      isEarlyExit: r.isEarlyExit,
      earlyExitByMinutes: r.earlyExitByMinutes,
    })),
    ...photoRecords.map((r): Row => ({
      id: `photo:${r.id}`,
      source: "remote",
      employee: photoEmpById.get(r.employeeId) ?? { id: r.employeeId, name: "Unknown", department: null },
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      doorName: null,
      checkInLat: null,
      checkInLng: null,
      checkInAddress: null,
      credentialType: null,
      note: r.checkInNote || r.checkOutNote,
      photoRecordId: r.id,
      ...photoFlags(r),
      // Legacy PhotoAttendanceRecord rows never carried these stats.
      workingMinutes: null,
      dayStatus: null,
      isLate: false,
      lateByMinutes: null,
      isEarlyExit: false,
      earlyExitByMinutes: null,
    })),
  ].sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());

  // Filter for the displayed rows, but keep allRows for the Present count so
  // the KPI reflects everyone present regardless of the active filter.
  let rows = sourceFilter ? allRows.filter((r) => r.source === sourceFilter) : allRows;
  if (statFilter === "full") rows = rows.filter((r) => r.dayStatus === "FULL_DAY");
  else if (statFilter === "half") rows = rows.filter((r) => r.dayStatus === "HALF_DAY");
  else if (statFilter === "late") rows = rows.filter((r) => r.isLate);
  else if (statFilter === "in-office") rows = rows.filter((r) => !r.checkOut);

  const totalEmployees = managedIds.length;
  // Present = distinct employees with ANY attendance today (unifi/gps/photo).
  const presentEmployeeIds = new Set(allRows.map((r) => r.employee.id));
  const present = presentEmployeeIds.size;
  const totalRows = rows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePageIdx = Math.min(pageIdx, pageCount - 1);
  const pagedRecords = rows.slice(safePageIdx * PAGE_SIZE, (safePageIdx + 1) * PAGE_SIZE);
  const onLeaveCount = Array.from(onLeaveByEmployee.keys()).filter(
    (id) => !presentEmployeeIds.has(id)
  ).length;
  const absent = Math.max(0, totalEmployees - present - onLeaveCount);
  // Still-in per row (a photo check-in with no check-out is still counted).
  const checkedOutRows = allRows.filter((r) => r.checkOut).length;
  const stillIn = allRows.length - checkedOutRows;
  // Derived attendance rollups — full/half only counted once check-out is in;
  // "late today" is informational, includes still-in employees.
  const fullDaysToday = allRows.filter((r) => r.dayStatus === "FULL_DAY").length;
  const halfDaysToday = allRows.filter((r) => r.dayStatus === "HALF_DAY").length;
  const lateToday = allRows.filter((r) => r.isLate).length;

  // Today against the 7 days before it. Only days when someone checked in count toward the average, so weekends and
  // holidays don't drag it down.
  const baseFrom = new Date(date);
  baseFrom.setUTCDate(baseFrom.getUTCDate() - 7);
  const baseRecords = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: managedIds }, date: { gte: baseFrom, lt: date } },
    select: { date: true, workingMinutes: true, isLate: true, checkIn: true, checkOut: true },
  });
  const baseDays = Array.from(new Set(baseRecords.map((r) => r.date.toISOString().slice(0, 10))));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const byBaseDay = (pick: (rs: typeof baseRecords) => number) => avg(baseDays.map((d) => pick(baseRecords.filter((r) => r.date.toISOString().slice(0, 10) === d))));
  // Stored minutes when check-out wrote them, otherwise worked out from the two times.
  const mins = (r: { workingMinutes: number | null; checkIn: Date; checkOut: Date | null }) => r.workingMinutes ?? (r.checkOut ? workingMinutes(r.checkIn, r.checkOut) : null);
  const baseWorked = baseRecords.map(mins).filter((m): m is number => m != null);
  const todayWorked = allRows.map(mins).filter((m): m is number => m != null);
  const kpi = {
    rate: totalEmployees ? (present / totalEmployees) * 100 : 0,
    baseRate: totalEmployees ? byBaseDay((rs) => (rs.length / totalEmployees) * 100) : null,
    basePresent: byBaseDay((rs) => rs.length),
    hours: avg(todayWorked) == null ? null : avg(todayWorked)! / 60,
    baseHours: avg(baseWorked) == null ? null : avg(baseWorked)! / 60,
    baseLate: byBaseDay((rs) => rs.filter((r) => r.isLate).length),
  };

  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  const isToday = date.toDateString() === new Date().toDateString();
  const dateStr = date.toISOString().split("T")[0];

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <AttendanceHealthBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-grey-900">Attendance</h1>
          <p className="text-sm font-body text-grey-500">Attendance source: GPS + selfie check-in. Face-scan door taps are logged separately for security only.</p>
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

      {/* Four headline numbers, each against the previous 7 days; the chips under them filter the log. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TrendCard icon={CalendarCheck} title="Attendance Rate" value={`${Math.round(kpi.rate)}`} unit="%" sub={`${present} of ${totalEmployees} present`}
          change={kpi.baseRate == null ? null : kpi.rate - kpi.baseRate} points />
        <TrendCard icon={UserCheck} title="Present Today" value={String(present)} unit={`/ ${totalEmployees}`} sub={`${onLeaveCount} on leave · ${absent} absent`}
          change={kpi.basePresent ? ((present - kpi.basePresent) / kpi.basePresent) * 100 : null} />
        <TrendCard icon={Clock} title="Average Working Hours" value={kpi.hours == null ? "—" : kpi.hours.toFixed(1)} unit={kpi.hours == null ? "" : "hrs"}
          sub={kpi.hours == null ? "No check-outs yet" : "Per employee, checked out"}
          change={kpi.hours != null && kpi.baseHours ? ((kpi.hours - kpi.baseHours) / kpi.baseHours) * 100 : null} />
        <TrendCard icon={TimerOff} title="Late Arrivals" value={String(lateToday)} unit={present ? `of ${present}` : ""} sub="After their start time"
          change={kpi.baseLate ? ((lateToday - kpi.baseLate) / kpi.baseLate) * 100 : kpi.baseLate === 0 && lateToday ? 100 : null} upIsBad
          href={statHref(dateStr, sourceFilter, statFilter === "late" ? null : "late")} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-grey-500">Show in log:</span>
        {([
          ["full", "Full days", fullDaysToday],
          ["half", "Half days", halfDaysToday],
          ["late", "Late", lateToday],
          ["in-office", "Still in office", stillIn],
        ] as const).map(([key, label, value]) => (
          <a key={key} href={statHref(dateStr, sourceFilter, statFilter === key ? null : key)}
            className={`rounded-full border px-3 py-1 transition-colors ${statFilter === key ? "border-primary bg-primary text-white" : "border-grey-200 bg-card text-grey-700 hover:bg-light-600"}`}>
            {label} <span className="font-number font-semibold">{value}</span>
          </a>
        ))}
      </div>
      {statFilter && (
        <div className="-mt-4 flex justify-end">
          <a
            href={statHref(dateStr, sourceFilter, null)}
            className="text-xs font-body text-grey-500 hover:text-primary hover:underline"
          >
            Clear filter
          </a>
        </div>
      )}

      {/* Attendance Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-200 flex items-center justify-between gap-4">
          <h2 className="font-heading text-base font-semibold text-grey-900">Attendance Log</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-md border border-grey-200 text-xs font-body">
              {(["all", "unifi", "remote"] as const).map((s) => {
                const active = (sourceFilter ?? "all") === s;
                const label = s === "all" ? "All" : s === "unifi" ? "Face Scan" : "Remote";
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

        {totalRows === 0 ? (
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
                  <th className="px-6 py-3">Day Status</th>
                  <th className="px-6 py-3">Late</th>
                  <th className="px-6 py-3">Early Exit</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Photo</th>
                  <th className="px-6 py-3">Door / Location</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-100">
                {pagedRecords.map((record) => {
                  const sourceLabel = record.source === "unifi" ? "Face Scan" : "Remote Check-in";
                  const sourceClass =
                    record.source === "unifi"
                      ? "bg-grey-50 text-grey-700"
                      : "bg-primary-transparent text-primary border-primary/30";
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
                      {record.workingMinutes != null
                        ? `${Math.floor(record.workingMinutes / 60)}h ${record.workingMinutes % 60}m`
                        : getWorkingHours(record.checkIn, record.checkOut)}
                    </td>
                    <td className="px-6 py-4">
                      {record.dayStatus === "FULL_DAY" ? (
                        <Badge variant="outline" className="text-xs bg-success-transparent text-success border-success/30">Full Day</Badge>
                      ) : record.dayStatus === "HALF_DAY" ? (
                        <Badge variant="outline" className="text-xs bg-orange-transparent text-orange border-orange/30">Half Day</Badge>
                      ) : record.checkOut ? (
                        <span className="text-xs font-body text-grey-300">-</span>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-info-transparent text-info border-info/30">In Progress</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {record.isLate && record.lateByMinutes != null ? (
                        <span
                          className="inline-flex items-center rounded-full bg-warning-transparent px-2 py-0.5 text-[11px] font-body font-medium text-warning-900"
                          title="Grace period 15 min, informational only — no deduction"
                        >
                          <span className="font-number">{record.lateByMinutes}</span> min
                        </span>
                      ) : (
                        <span className="text-xs font-body text-grey-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {record.isEarlyExit && record.earlyExitByMinutes != null ? (
                        <span className="inline-flex items-center rounded-full bg-orange-transparent px-2 py-0.5 text-[11px] font-body font-medium text-orange">
                          <span className="font-number">{record.earlyExitByMinutes}</span> min early
                        </span>
                      ) : (
                        <span className="text-xs font-body text-grey-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={`text-xs ${sourceClass}`}>
                        {sourceLabel}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {record.photoRecordId ? (
                        <div className="flex items-center gap-2">
                          {record.checkInPhotoUrl && (
                            <AdminPhotoThumb
                              recordId={record.photoRecordId}
                              side="checkIn"
                              title="Check in"
                            />
                          )}
                          {record.checkOutPhotoUrl && (
                            <AdminPhotoThumb
                              recordId={record.photoRecordId}
                              side="checkOut"
                              title="Check out"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-body text-grey-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-body text-grey-600">
                      {record.source === "unifi" ? (
                        <span className="font-number text-grey-500">{record.doorName || "-"}</span>
                      ) : record.checkInLat != null && record.checkInLng != null ? (
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
                              : <span className="font-number">{record.checkInLat.toFixed(4)}, {record.checkInLng.toFixed(4)}</span>}
                          </a>
                          {record.note && (
                            <span className="text-xs italic text-grey-500" title={record.note}>
                              "{record.note.length > 40 ? record.note.slice(0, 40) + "…" : record.note}"
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-body text-grey-300">-</span>
                      )}
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
        {totalRows > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-grey-100 px-6 py-3">
            <span className="text-xs font-number text-grey-500">
              {safePageIdx * PAGE_SIZE + 1}–{Math.min((safePageIdx + 1) * PAGE_SIZE, totalRows)} of {totalRows}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                {Array.from({ length: pageCount }, (_, i) => {
                  const active = i === safePageIdx;
                  const params = new URLSearchParams();
                  if (dateParam) params.set("date", dateParam);
                  if (sourceFilter) params.set("source", sourceFilter);
                  if (statFilter) params.set("stat", statFilter);
                  if (i > 0) params.set("page", String(i + 1));
                  const qs = params.toString();
                  const href = qs ? `/attendance?${qs}` : "/attendance";
                  return (
                    <a
                      key={i}
                      href={href}
                      className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-2 text-xs font-number ${
                        active ? "bg-primary text-white" : "text-grey-600 hover:bg-light-600"
                      }`}
                    >
                      {i + 1}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function statHref(
  dateStr: string,
  source: "unifi" | "remote" | null,
  stat: "full" | "half" | "late" | "in-office" | null
): string {
  const params = new URLSearchParams();
  params.set("date", dateStr);
  if (source) params.set("source", source);
  if (stat) params.set("stat", stat);
  return `/attendance?${params.toString()}`;
}

// A headline number with its change against the previous 7 days: green arrow when that's good news, red when it isn't.
function TrendCard({ icon: Icon, title, value, unit, sub, change, points, upIsBad, href }: {
  icon: LucideIcon; title: string; value: string; unit?: string; sub: string; change: number | null; points?: boolean; upIsBad?: boolean; href?: string;
}) {
  const flat = change != null && Math.abs(change) < 0.05;
  const up = (change ?? 0) >= 0;
  const good = upIsBad ? !up : up;
  const tone = flat ? "grey" : good ? "good" : "bad";
  const body = (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white"><Icon className="h-5 w-5" /></span>
        <h3 className="font-heading text-base font-medium text-grey-900">{title}</h3>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="font-number text-4xl font-semibold leading-none text-grey-900">
            {value}{unit && <span className="ml-1.5 text-xl font-normal text-grey-400">{unit}</span>}
          </p>
          <p className="mt-2 truncate text-sm text-grey-500">{sub}</p>
        </div>
        {change != null && Number.isFinite(change) && (
          <div className="flex shrink-0 items-center gap-2" title="Compared with the previous 7 days">
            <span className={`font-number text-sm font-medium ${tone === "grey" ? "text-grey-500" : tone === "good" ? "text-success" : "text-error"}`}>{flat ? "" : up ? "+" : "−"}{Math.abs(change).toFixed(1)}{points ? " pts" : "%"}</span>
            <span className={`flex h-9 w-9 items-center justify-center rounded-full text-white ${tone === "grey" ? "bg-grey-300" : tone === "good" ? "bg-success" : "bg-error"}`}>
              {flat ? <Minus className="h-4 w-4" /> : up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
  return href ? <a href={href} className="block rounded-xl transition-transform hover:-translate-y-0.5">{body}</a> : body;
}
