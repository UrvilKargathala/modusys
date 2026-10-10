import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { getManagedEmployeeIds } from "@/lib/server/managed-employees";
import { LEAVE_TYPES, istDateString, istMidnight, isWeekend, reportRange, weekdaysBetween, workingMinutes } from "@/lib/attendance-config";
import { AdminPhotoThumb } from "@/components/attendance/admin-photo-thumb";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ymd = (d: Date) => d.toISOString().split("T")[0];
const time = (d?: Date | null) =>
  d ? d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
const dayLabel = (d: Date) =>
  d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }) +
  " · " +
  d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short" });
const hm = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
const sourceLabel = (s?: string | null) => (!s ? "" : s === "unifi" ? "Face scan" : s.startsWith("gps") ? "GPS + selfie" : s === "manual" ? "Manual" : s);
const mapHref = (lat?: number | null, lng?: number | null) => (lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null);

// One person's attendance, day by day, for the Reports date range: check-in / check-out with source, place and selfie,
// hours, late / early exit, and every working day accounted for as Present, Leave or Absent.
export default async function EmployeeAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  const { employeeId } = await params;
  const sp = await searchParams;

  // Super admin: anyone they manage. Everyone else: only themselves.
  if (user.role === "super-admin") {
    if (!(await getManagedEmployeeIds()).includes(employeeId)) notFound();
  } else if ((await getCurrentEmployee()).employee?.id !== employeeId) {
    notFound();
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true, department: true, employeeNumber: true } });
  if (!employee) notFound();

  const { fromDate, toDate } = reportRange(sp);
  const [records, photos, leaves] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { employeeId, date: { gte: fromDate, lte: toDate } }, orderBy: { date: "asc" } }),
    prisma.photoAttendanceRecord.findMany({ where: { employeeId, date: { gte: fromDate, lte: toDate } } }),
    prisma.leaveRequest.findMany({ where: { employeeId, status: "APPROVED", fromDate: { lte: toDate }, toDate: { gte: fromDate } } }),
  ]);
  const recordByDay = new Map(records.map((r) => [ymd(r.date), r]));
  const photoByDay = new Map(photos.map((p) => [ymd(p.date), p]));
  const leaveFor = (d: Date) => leaves.find((l) => l.fromDate <= d && l.toDate >= d);
  const leaveLabel = (l: (typeof leaves)[number]) =>
    `${l.leaveType === "OTHER" && l.customLeaveType ? l.customLeaveType : (LEAVE_TYPES.find((t) => t.value === l.leaveType)?.label ?? l.leaveType)} leave${l.isHalfDay ? " (half day)" : ""}`;

  // Every day in the range, newest first. Weekends are listed only when there is a check-in.
  const todayYmd = istDateString();
  const days: Date[] = [];
  for (const d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) days.push(new Date(d));
  days.reverse();

  let totalMinutes = 0, full = 0, half = 0, inProgress = 0, late = 0, early = 0, leaveDays = 0;
  for (const r of records) {
    totalMinutes += r.workingMinutes ?? workingMinutes(r.checkIn, r.checkOut);
    if (r.dayStatus === "FULL_DAY") full++;
    else if (r.dayStatus === "HALF_DAY") half++;
    else inProgress++; // checked in, no check-out yet
    if (r.isLate) late++;
    if (r.isEarlyExit) early++;
  }
  for (const l of leaves) {
    const s = l.fromDate > fromDate ? l.fromDate : fromDate;
    const e = l.toDate < toDate ? l.toDate : toDate;
    leaveDays += l.isHalfDay ? 0.5 : weekdaysBetween(s, e);
  }
  // Days still to come are not counted as working days (so they can't show as absent).
  const today = istMidnight();
  const workingDays = weekdaysBetween(fromDate, toDate > today ? today : toDate);
  const absences = Math.max(0, workingDays - records.length - leaveDays);
  const qs = `from=${ymd(fromDate)}&to=${ymd(toDate)}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/attendance/reports?${qs}&preset=custom`} aria-label="Back to reports" className="rounded-md p-1.5 text-grey-500 hover:bg-light-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-grey-900">{employee.name}</h1>
            <p className="text-sm font-body text-grey-500">
              {[employee.employeeNumber, employee.department].filter(Boolean).join(" · ") || "Employee"} · {dayLabel(fromDate).split(" · ")[0]} – {dayLabel(toDate).split(" · ")[0]}
            </p>
          </div>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="preset" value="custom" />
          <label className="flex flex-col gap-1 text-xs font-body text-grey-500">
            From
            <input type="date" name="from" defaultValue={ymd(fromDate)} className="h-9 rounded-md border border-grey-200 px-2 text-sm text-grey-900" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-body text-grey-500">
            To
            <input type="date" name="to" defaultValue={ymd(toDate)} className="h-9 rounded-md border border-grey-200 px-2 text-sm text-grey-900" />
          </label>
          <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-body font-medium text-white hover:bg-primary/90">Apply</button>
          {(["week", "", "last-month"] as const).map((p) => (
            <a key={p} href={`/attendance/reports/${employeeId}${p ? `?preset=${p}` : ""}`} className="rounded-full border border-grey-200 px-3 py-1 text-xs text-grey-600 hover:bg-grey-50">
              {p === "week" ? "This Week" : p === "" ? "This Month" : "Last Month"}
            </a>
          ))}
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Full Day Total", full, "Worked 4h 30m or more", "bg-success-transparent", "text-success"],
          ["In Progress Total", inProgress, "Checked in, not checked out yet", "bg-info-transparent", "text-info"],
          ["Absent Total", absences, "Working days with no check-in or leave", "bg-error-transparent", "text-error"],
        ].map(([label, value, hint, bg, fg]) => (
          <Card key={String(label)} className={`flex flex-col gap-1 p-5 ${bg}`}>
            <p className={`text-sm font-body font-medium ${fg}`}>{label}</p>
            <p className={`font-number text-4xl font-light ${fg}`}>{value}</p>
            <p className="text-xs font-body text-grey-500">{hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          ["Total Hours", (totalMinutes / 60).toFixed(1)],
          ["Avg / Day", records.length ? (totalMinutes / 60 / records.length).toFixed(1) : "0.0"],
          ["Half Days", String(half)],
          ["Late", String(late)],
          ["Early Exits", String(early)],
          ["Leave / Absent", `${leaveDays} / ${absences}`],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs font-body text-grey-500">{label}</p>
            <p className="mt-1 font-number text-2xl font-light text-grey-900">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-light-600 text-left text-xs font-heading font-medium uppercase tracking-wider text-grey-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Late / Early</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {days.map((d) => {
                const key = ymd(d);
                const r = recordByDay.get(key);
                const photo = photoByDay.get(key);
                const weekend = isWeekend(d);
                const leave = leaveFor(d);
                if (!r && weekend) return null;
                const future = key > todayYmd;
                const status = r
                  ? r.dayStatus === "FULL_DAY" ? ["Full day", "bg-success-transparent text-success"]
                  : r.dayStatus === "HALF_DAY" ? ["Half day", "bg-orange-transparent text-orange"]
                  : ["In progress", "bg-info-transparent text-info"]
                  : leave ? [leaveLabel(leave), "bg-warning-transparent text-warning-900"]
                  : future ? ["Upcoming", "bg-grey-transparent text-grey-500"]
                  : ["Absent", "bg-error-transparent text-error"];
                const side = (
                  which: "in" | "out",
                ) => {
                  if (!r) return <span className="text-grey-300">—</span>;
                  const t = which === "in" ? r.checkIn : r.checkOut;
                  const src = which === "in" ? r.checkInSource : r.checkOutSource;
                  const addr = which === "in" ? r.checkInAddress : r.checkOutAddress;
                  const door = which === "in" ? r.doorName : r.checkOutDoorName;
                  const map = which === "in" ? mapHref(r.checkInLat, r.checkInLng) : mapHref(r.checkOutLat, r.checkOutLng);
                  // The selfie lives on the attendance record (GPS check-ins) or, for older photo check-ins, in its own table.
                  const keyOf = (x?: { checkInPhotoKey: string | null; checkOutPhotoKey: string | null } | null) => (which === "in" ? x?.checkInPhotoKey : x?.checkOutPhotoKey);
                  const photoId = keyOf(r) ? r.id : keyOf(photo) ? photo!.id : null;
                  return (
                    <div className="flex items-start gap-2">
                      {photoId && <AdminPhotoThumb recordId={photoId} side={which === "in" ? "checkIn" : "checkOut"} title={`${which === "in" ? "Check-in" : "Check-out"} selfie`} />}
                      <div className="flex min-w-0 flex-col">
                        <span className="font-number text-sm text-grey-900">{time(t)}</span>
                        {t && <span className="text-xs text-grey-500">{[sourceLabel(src), door].filter(Boolean).join(" · ")}</span>}
                        {addr && <span className="max-w-[260px] truncate text-xs text-grey-500" title={addr}>{addr}</span>}
                        {map && (
                          <a href={map} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-secondary hover:underline">
                            <MapPin className="h-3 w-3" /> Map
                          </a>
                        )}
                      </div>
                    </div>
                  );
                };
                const mins = r ? (r.workingMinutes ?? workingMinutes(r.checkIn, r.checkOut)) : 0;
                return (
                  <tr key={key} className="align-top hover:bg-light-600/50">
                    <td className="whitespace-nowrap px-4 py-3 font-number text-sm text-grey-900">{dayLabel(d)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-body font-medium ${status[1]}`}>{status[0]}</span>
                    </td>
                    <td className="px-4 py-3">{side("in")}</td>
                    <td className="px-4 py-3">{r && !r.checkOut ? <span className="text-xs text-grey-500">Not checked out</span> : side("out")}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-number text-sm text-grey-700">{r ? hm(mins) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {r?.isLate && <div className="text-warning-900">Late {r.lateByMinutes ?? 0}m</div>}
                      {r?.isEarlyExit && <div className="text-warning-900">Early {r.earlyExitByMinutes ?? 0}m</div>}
                      {r && !r.isLate && !r.isEarlyExit && <span className="text-grey-400">On time</span>}
                    </td>
                    <td className="max-w-[240px] px-4 py-3 text-xs text-grey-600">
                      {[r?.checkInNote, r?.checkOutNote, r?.notes, !r && leave ? leave.reason : null].filter(Boolean).join(" · ") || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
