import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { formatTime, getWorkingHours, formatDate } from "@/lib/attendance-utils";
import { istMidnight } from "@/lib/attendance-config";
import { SyncButtons } from "@/components/attendance/sync-buttons";
import { AutoRefresh } from "@/components/attendance/auto-refresh";
import { AttendanceHealthBanner } from "@/components/attendance/health-banner";
import { AdminPhotoThumb } from "@/components/attendance/admin-photo-thumb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  Users,
  UserCheck,
  Umbrella,
  UserX,
  CheckCircle2,
  Coffee,
  Clock,
  DoorOpen,
  type LucideIcon,
} from "lucide-react";

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
  // The id used by the photo broker (/api/attendance/photo/[id]/[type]).
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

  // Fetch both tables in parallel — filter by source at merge time.
  const [attRecords, photoRecords] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { date },
      include: {
        employee: {
          select: { id: true, name: true, department: true, designation: true },
        },
      },
      orderBy: { checkIn: "desc" },
    }),
    prisma.photoAttendanceRecord.findMany({
      where: { date },
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
      photoRecordId: r.checkInPhotoUrl || r.checkOutPhotoUrl ? r.id : null,
      checkInPhotoUrl: r.checkInPhotoUrl,
      checkOutPhotoUrl: r.checkOutPhotoUrl,
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
      checkInPhotoUrl: r.checkInPhotoUrl,
      checkOutPhotoUrl: r.checkOutPhotoUrl,
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

  const totalEmployees = await prisma.employee.count({ where: { isActive: true } });
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

      {/* Stats — single compact row (wraps on mobile). Label left, number
          right in the stat's semantic color for at-a-glance scanning. The
          four "log-mappable" pills (Full/Half/Late/Still In) are clickable
          filters that narrow the attendance log below. Others are display-
          only because they don't correspond to a subset of table rows. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatPill icon={Users} label="Total Employees" value={totalEmployees} tone="grey" />
        <StatPill
          icon={UserCheck}
          label="Present"
          value={present}
          total={totalEmployees}
          tone="success"
        />
        <StatPill
          icon={Umbrella}
          label="On Leave"
          value={onLeaveCount}
          total={totalEmployees}
          tone="warning"
        />
        <StatPill
          icon={UserX}
          label="Absent"
          value={absent}
          total={totalEmployees}
          tone="error"
        />
        <StatPill
          icon={CheckCircle2}
          label="Full Days"
          value={fullDaysToday}
          tone="success"
          filterHref={statHref(dateStr, sourceFilter, "full")}
          active={statFilter === "full"}
        />
        <StatPill
          icon={Coffee}
          label="Half Days"
          value={halfDaysToday}
          tone="orange"
          filterHref={statHref(dateStr, sourceFilter, "half")}
          active={statFilter === "half"}
        />
        <StatPill
          icon={Clock}
          label="Late Arrivals"
          value={lateToday}
          tone="warning"
          hint="informational only"
          title="Informational only — no salary deduction"
          filterHref={statHref(dateStr, sourceFilter, "late")}
          active={statFilter === "late"}
        />
        <StatPill
          icon={DoorOpen}
          label="Still In Office"
          value={stillIn}
          tone="info"
          filterHref={statHref(dateStr, sourceFilter, "in-office")}
          active={statFilter === "in-office"}
        />
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
                              : `${record.checkInLat.toFixed(4)}, ${record.checkInLng.toFixed(4)}`}
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

function StatPill({
  icon: Icon,
  label,
  value,
  total,
  tone,
  title,
  hint,
  filterHref,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  total?: number;
  tone: "grey" | "success" | "warning" | "orange" | "error" | "info";
  title?: string;
  hint?: string;
  filterHref?: string;
  active?: boolean;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning-900"
      : tone === "orange"
      ? "text-orange"
      : tone === "error"
      ? "text-error"
      : tone === "info"
      ? "text-info"
      : "text-grey-900";
  const iconBg =
    tone === "success"
      ? "bg-success-transparent"
      : tone === "warning"
      ? "bg-warning-transparent"
      : tone === "orange"
      ? "bg-orange-transparent"
      : tone === "error"
      ? "bg-error-transparent"
      : tone === "info"
      ? "bg-info-transparent"
      : "bg-grey-transparent";
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  const inner = (
    <div className="flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-body text-grey-500">{label}</span>
        <div className="flex items-baseline gap-1.5">
          <span className={`font-number text-xl font-bold ${color}`}>{value}</span>
          {pct !== null && (
            <span className="font-number text-[11px] text-grey-400">· {pct}%</span>
          )}
        </div>
        {hint && <span className="text-[10px] font-body text-grey-400">{hint}</span>}
      </div>
    </div>
  );
  const activeCls = active ? "ring-2 ring-primary/40 bg-primary-transparent/40" : "ring-1 ring-foreground/10";
  const hoverCls = filterHref ? "hover:ring-primary/30 cursor-pointer transition-shadow" : "";
  const commonCls = `rounded-xl bg-card p-3 ${activeCls} ${hoverCls}`;
  if (filterHref) {
    return (
      <a href={filterHref} title={title} className={`block ${commonCls}`}>
        {inner}
      </a>
    );
  }
  return (
    <div title={title} className={commonCls}>
      {inner}
    </div>
  );
}
