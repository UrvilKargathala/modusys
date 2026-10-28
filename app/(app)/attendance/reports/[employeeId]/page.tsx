import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Download, Lock, MapPin, Star, X } from "lucide-react";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { getManagedEmployeeIds } from "@/lib/server/managed-employees";
import { getPayrollEmployees, loadPayroll, payrollEmployeeSelect, toPayrollEmployee } from "@/lib/server/payroll-data";
import { LEAVE_TYPES, istDateString, reportRange } from "@/lib/attendance-config";
import { WEEKDAYS, hoursText, istMinuteOfDay, monthRange, scheduleOf, type PayrollDay } from "@/lib/payroll";
import { formatInr } from "@/lib/format";
import { AdminPhotoThumb } from "@/components/attendance/admin-photo-thumb";
import { AdjustmentsPanel, FinalizeButton, OvertimeToggle } from "@/components/payroll/payroll-actions";
import { EmployeeFormDialog } from "@/components/payroll/employee-form-dialog";
import { EditTimesButton } from "@/components/payroll/attendance-time-dialogs";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ymd = (d: Date) => d.toISOString().split("T")[0];
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const time = (d?: Date | null) => (d ? d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }) : "—");
const clockOf = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(Math.round(m % 60)).padStart(2, "0")} ${m < 720 ? "am" : "pm"}`;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const hm24 = (d: Date | null) => (d ? hhmm(istMinuteOfDay(d)) : "");
const longDate = (s: string) => utc(s).toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
const dmy = (s: string) => s.split("-").reverse().join("/");
const sourceLabel = (s?: string | null) => (!s ? "" : s === "unifi" ? "Face scan" : s.startsWith("gps") ? "GPS + selfie" : s === "manual" ? "Manual" : s);
const mapHref = (lat?: number | null, lng?: number | null) => (lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null);
const money = (n: number | null) => (n == null ? "—" : formatInr(n));
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

// What a day looks like in the strip and the table: one place for the colours and words.
type Look = { key: string; label: string; chip: string; dot: string };
function lookOf(d: PayrollDay, required: number | null): Look {
  if (d.status === "ABSENT") return { key: "absent", label: "Absent", chip: "bg-error-transparent text-error", dot: "bg-error-transparent text-error ring-1 ring-error/40" };
  if (d.status === "LEAVE") return { key: "leave", label: d.leaveLabel ?? "Leave", chip: "bg-purple-transparent text-purple", dot: "bg-purple text-white" };
  if (d.status === "OFF") return d.offReason === "HOLIDAY"
    ? { key: "holiday", label: d.holidayName ?? "Holiday", chip: "bg-pink-transparent text-pink", dot: "bg-pink-transparent text-pink" }
    : { key: "off", label: "Weekly off", chip: "bg-grey-transparent text-grey-500", dot: "bg-grey-100 text-grey-400" };
  if (d.status === "UPCOMING" || d.status === "BEFORE_START") return { key: "none", label: d.status === "UPCOMING" ? "Upcoming" : "Not started", chip: "bg-grey-transparent text-grey-400", dot: "border border-dashed border-grey-200 text-grey-300" };
  if (d.status === "IN_PROGRESS") return { key: "in", label: "At work", chip: "bg-info-transparent text-info", dot: "bg-info text-white" };
  if (d.status === "MISSING_CHECKOUT" || d.status === "INVALID") return { key: "half", label: d.status === "INVALID" ? "Invalid times" : "No check-out", chip: "bg-error-transparent text-error", dot: "bg-[conic-gradient(var(--color-error)_0_50%,transparent_50%_100%)] ring-1 ring-error text-white" };
  if (d.status === "OFF_WORKED") return { key: "present", label: `Worked on ${d.holidayName ?? "weekly off"}`, chip: "bg-purple-transparent text-purple", dot: "bg-success/60 text-white" };
  if (required && d.actualMinutes < required / 2) return { key: "half", label: "Half day", chip: "bg-error-transparent text-error", dot: "bg-[conic-gradient(var(--color-error)_0_50%,transparent_50%_100%)] ring-1 ring-error text-white" };
  if (d.lateMinutes > 0) return { key: "late", label: `Late ${d.lateMinutes}m`, chip: "bg-orange-transparent text-orange", dot: "bg-orange text-white" };
  return { key: "present", label: d.earlyMinutes > 0 ? `Early exit ${d.earlyMinutes}m` : "On time", chip: d.earlyMinutes > 0 ? "bg-warning-transparent text-warning-900" : "bg-success-transparent text-success", dot: "bg-success text-white" };
}
const LEGEND: [string, string][] = [["Present", "bg-success"], ["Late", "bg-orange"], ["Half day", "bg-error"], ["Absent", "bg-error-transparent ring-1 ring-error/40"], ["Leave", "bg-purple"], ["Holiday", "bg-pink"], ["Weekly off", "bg-grey-200"]];

// One person's attendance and pay for the Reports date range: their details and headline numbers, a day-by-day strip,
// and the full history. Statuses, hours, late / early and pay all come from the payroll engine, so they match Payroll.
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
  const admin = user.role === "super-admin";

  // Super admin: anyone attendance or payroll covers. Everyone else: only themselves.
  if (admin) {
    if (!(await getManagedEmployeeIds()).includes(employeeId) && !(await getPayrollEmployees(employeeId)).length) notFound();
  } else if ((await getCurrentEmployee()).employee?.id !== employeeId) {
    notFound();
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: payrollEmployeeSelect });
  if (!employee) notFound();
  const pe = toPayrollEmployee(employee);
  const sch = scheduleOf(pe);

  const { fromDate, toDate } = reportRange(sp);
  const from = ymd(fromDate);
  const to = ymd(toDate);
  // A report covering exactly one calendar month gets that month's adjustments, finalize control and CSV.
  const period = from.slice(0, 7);
  const wholeMonth = monthRange(period).from === from && monthRange(period).to === to ? period : null;

  const [[pay], records, photos, adjustments, leaves] = await Promise.all([
    loadPayroll(from, to, [employee]),
    prisma.attendanceRecord.findMany({ where: { employeeId, date: { gte: fromDate, lte: toDate } } }),
    prisma.photoAttendanceRecord.findMany({ where: { employeeId, date: { gte: fromDate, lte: toDate } } }),
    wholeMonth ? prisma.salaryAdjustment.findMany({ where: { employeeId, period: wholeMonth }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    prisma.leaveRequest.findMany({ where: { employeeId, status: "APPROVED", fromDate: { lte: toDate }, toDate: { gte: fromDate } } }),
  ]);
  const reviewers = await prisma.user.findMany({ where: { id: { in: leaves.map((l) => l.reviewedBy).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const s = pay.summary;
  const today = istDateString();
  const recordById = new Map(records.map((r) => [r.id, r]));
  const photoByDay = new Map(photos.map((p) => [ymd(p.date), p]));
  const leaveOn = (d: string) => leaves.find((l) => ymd(l.fromDate) <= d && ymd(l.toDate) >= d);
  const finalized = wholeMonth ? pay.finalizedMonths.includes(wholeMonth) : false;
  const locked = (d: string) => pay.finalizedMonths.includes(d.slice(0, 7));
  const monthEnded = wholeMonth ? to < today : false;
  // History: newest first, without plain weekly offs and days still to come.
  const history = pay.days.filter((d) => d.status !== "BEFORE_START" && d.status !== "UPCOMING" && !(d.status === "OFF" && d.offReason === "WEEKLY_OFF")).reverse();

  const worked = pay.days.filter((d) => d.checkIn);
  const avgMin = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const avgIn = avgMin(worked.map((d) => istMinuteOfDay(d.checkIn!)));
  const avgOut = avgMin(worked.filter((d) => d.checkOut).map((d) => istMinuteOfDay(d.checkOut!)));
  const qs = `from=${from}&to=${to}`;
  const csv = wholeMonth ? `/api/attendance/payroll/export?view=month&value=${wholeMonth}&employeeId=${employeeId}` : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/attendance/reports?${qs}&preset=custom`} aria-label="Back to reports" className="rounded-md p-1.5 text-grey-500 hover:bg-light-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-grey-900">Attendance Report</h1>
            <p className="text-sm text-grey-500">Attendance, hours and pay for {employee.name} · {dmy(from)} – {dmy(to)}</p>
          </div>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="preset" value="custom" />
          <input type="date" name="from" defaultValue={from} aria-label="From" className="h-9 rounded-lg border border-grey-200 bg-card px-2 text-sm text-grey-900" />
          <span className="text-grey-400">–</span>
          <input type="date" name="to" defaultValue={to} aria-label="To" className="h-9 rounded-lg border border-grey-200 bg-card px-2 text-sm text-grey-900" />
          <button type="submit" className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90">Apply</button>
          {(["week", "", "last-month"] as const).map((p) => (
            <a key={p} href={`/attendance/reports/${employeeId}${p ? `?preset=${p}` : ""}`} className="rounded-full border border-grey-200 bg-card px-3 py-1 text-xs text-grey-600 hover:bg-light-600">
              {p === "week" ? "This Week" : p === "" ? "This Month" : "Last Month"}
            </a>
          ))}
        </form>
      </div>

      {s.issues.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning bg-warning-transparent px-4 py-3 text-sm text-warning-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {s.issues.map((i) => (i === "NO_RATE" ? "No hourly rate set" : "No working schedule set")).join(" and ")}, so salary is not calculated.
          {admin && <Link href="/attendance/employees" className="ml-1 font-medium underline">Set up on Employees</Link>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Employee details, with the month's pay along the bottom. */}
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-lg font-medium text-grey-900"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Employee Details</h2>
            <div className="flex items-center gap-2">
              {admin && <span className="rounded-full border border-grey-200 bg-card"><EmployeeFormDialog employee={{ ...employee, ...pe }} /></span>}
              {csv && (
                <a href={csv} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90">
                  <Download className="h-4 w-4" /> Download
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex flex-col items-center gap-1.5">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-transparent font-heading text-2xl font-semibold text-primary ring-4 ring-white">{initials(employee.name)}</span>
              <span className="rounded-full bg-success px-2 py-0.5 font-number text-[10px] font-medium text-white">
                {sch ? `${clockOf(sch.start)} – ${clockOf(sch.end)}` : "No schedule"}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className="font-heading text-xl font-semibold text-grey-900">{employee.name}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                {[
                  ["Role", [employee.designation, employee.department].filter(Boolean).join(" · ") || "—"],
                  ["Employee ID", employee.employeeNumber ?? "—"],
                  ["Email", employee.email ?? "—"],
                  ["Phone", employee.phone ?? "—"],
                  ["Hours / day", sch ? hoursText(sch.required) : "—"],
                  ["Weekly off", pe.weeklyOffDays.length ? pe.weeklyOffDays.map((d) => WEEKDAYS[d]).join(", ") : "None"],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <p className="text-xs text-grey-500">{k}</p>
                    <p className="truncate font-medium text-grey-900" title={v}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-grey-100 pt-3">
            <p className="font-number text-sm text-grey-600">
              {pe.monthlySalary != null && <>{formatInr(pe.monthlySalary)}/month<span className="text-grey-400"> → </span></>}{s.hourlyRate != null ? `${formatInr(s.hourlyRate)}/h` : s.issues.includes("NO_RATE") ? <span className="text-warning-900">No rate</span> : "rate varies by month"}
              <span className="text-grey-400"> · expected {money(s.expectedSalary)}</span>
            </p>
            <p className="font-number text-sm text-grey-700">
              {money(s.earnedSalary)} earned<span className="text-grey-400"> + </span>{money(s.overtimePay)} overtime
              {s.additions ? <><span className="text-grey-400"> + </span><span className="text-success">{formatInr(s.additions)}</span></> : null}
              {s.deductions ? <><span className="text-grey-400"> − </span><span className="text-error">{formatInr(s.deductions)}</span></> : null}
              <span className="text-grey-400"> = </span><span className="text-lg font-semibold text-primary">{money(s.finalSalary)}</span>
            </p>
            <div className="ml-auto flex items-center gap-2">
              {finalized && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-transparent px-2.5 py-0.5 text-xs font-medium text-success">
                  <Lock className="h-3 w-3" /> Finalized{s.finalized?.by ? ` by ${s.finalized.by}` : ""}
                </span>
              )}
              {admin && wholeMonth && (
                <FinalizeButton employeeId={employeeId} period={wholeMonth} finalized={finalized}
                  disabled={!monthEnded ? "A month can be finalized once it has ended" : s.issues.length ? "Set a schedule and hourly rate first" : undefined} />
              )}
            </div>
          </div>
          {admin && wholeMonth && (
            <details className="-mt-1" open={adjustments.length > 0}>
              <summary className="cursor-pointer text-xs font-medium text-secondary">Additions and deductions ({adjustments.length})</summary>
              <div className="pt-2">
                <AdjustmentsPanel employeeId={employeeId} period={wholeMonth} locked={finalized}
                  rows={adjustments.map((a) => ({ id: a.id, kind: a.kind, amount: Number(a.amount.toString()), reason: a.reason, createdBy: a.createdBy }))} />
              </div>
            </details>
          )}
          {admin && !wholeMonth && <p className="-mt-1 text-[11px] text-grey-400">Pick one whole calendar month to add adjustments, finalize or download it.</p>}
        </Card>

        {/* Four headline numbers. */}
        <div className="grid grid-cols-2 gap-4">
          {[
            ["Total Attendance", String(s.presentDays), `of ${s.scheduledDays} days`, `${s.absentDays} absent · ${s.leaveDays} leave`],
            ["Overtime", hoursText(s.overtimeMinutes), "", `${hoursText(s.approvedOvertimeMinutes)} approved`],
            ["Avg Clock-in", avgIn == null ? "—" : clockOf(avgIn).split(" ")[0], avgIn == null ? "" : clockOf(avgIn).split(" ")[1], `${s.lateDays} late · ${s.lateMinutes}m`],
            ["Avg Clock-out", avgOut == null ? "—" : clockOf(avgOut).split(" ")[0], avgOut == null ? "" : clockOf(avgOut).split(" ")[1], `${s.earlyDays} early · ${s.earlyMinutes}m`],
          ].map(([title, value, unit, sub]) => (
            <Card key={title} className="flex flex-col justify-between gap-3 p-5">
              <p className="font-heading text-base font-medium text-grey-900">{title}</p>
              <div>
                <p className="font-number text-3xl font-semibold leading-none text-grey-900">{value}{unit && <span className="ml-1.5 text-sm font-normal text-grey-500">{unit}</span>}</p>
                <p className="mt-2 text-xs text-grey-500">{sub}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Day-by-day strip: one circle per day, click to jump to that day in the history. */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-medium text-grey-900">Attendance</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-grey-100 bg-card px-3 py-1.5 text-[11px] text-grey-600">
            {LEGEND.map(([label, dot]) => <span key={label} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-full", dot)} />{label}</span>)}
          </div>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max justify-between gap-1 xl:min-w-full">
            {pay.days.map((d) => {
              const look = lookOf(d, sch?.required ?? null);
              const anchor = history.some((h) => h.date === d.date);
              const dot = (
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", look.dot)}>
                  {look.key === "present" || look.key === "late" ? <Check className="h-4 w-4" strokeWidth={3} />
                    : look.key === "absent" ? <X className="h-4 w-4" strokeWidth={3} />
                    : look.key === "holiday" ? <Star className="h-4 w-4" />
                    : null}
                </span>
              );
              return (
                <div key={d.date} className="flex w-9 flex-col items-center gap-1.5" title={`${dmy(d.date)} · ${look.label}`}>
                  <span className={cn("font-number text-sm", d.date === today ? "font-bold text-primary" : look.key === "none" || look.key === "off" ? "text-grey-400" : "text-grey-800")}>{d.date.slice(8)}</span>
                  {anchor ? <a href={`#day-${d.date}`} className="rounded-full transition-transform hover:scale-110">{dot}</a> : dot}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-grey-100 px-5 py-4">
          <h2 className="font-heading text-lg font-medium text-grey-900">Attendance History</h2>
          {csv && (
            <a href={csv} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90">
              <Download className="h-4 w-4" /> Download Report
            </a>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead>
              <tr className="bg-light-600 text-xs font-medium text-grey-500">
                {["Date", "Status", "Source", "Break", "Clock-in", "Clock-out", "Overtime", "Working Hours", "Location", ""].map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {history.map((d) => {
                const r = d.recordId ? recordById.get(d.recordId) : undefined;
                const photo = photoByDay.get(d.date);
                const look = lookOf(d, sch?.required ?? null);
                const dateCell = (
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="mr-2 inline-flex w-11 justify-center rounded-full border border-grey-200 bg-card py-0.5 text-xs text-grey-700">{WEEKDAYS[d.weekday]}</span>
                    <span className="font-number text-grey-900">{longDate(d.date)}</span>
                  </td>
                );
                // Approved leave: one row with who approved it and why, instead of empty time columns.
                if (d.status === "LEAVE") {
                  const l = leaveOn(d.date);
                  const by = reviewers.find((u) => u.id === l?.reviewedBy)?.name;
                  const type = l ? (l.leaveType === "OTHER" && l.customLeaveType ? l.customLeaveType : (LEAVE_TYPES.find((t) => t.value === l.leaveType)?.label ?? l.leaveType)) : "Leave";
                  return (
                    <tr key={d.date} id={`day-${d.date}`} className="scroll-mt-24 bg-purple-transparent/60 shadow-[inset_3px_0_0_var(--color-purple)]">
                      {dateCell}
                      <td colSpan={9} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs">
                          <span className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple font-semibold text-white">{type[0]}</span>
                            <span><span className="block text-grey-500">Time off</span><span className="text-sm text-grey-900">{by ? `Approved by ${by}` : "Approved"}</span></span>
                          </span>
                          {l?.reviewedAt && <span><span className="block text-grey-500">Approved on</span><span className="font-number text-sm text-grey-900">{l.reviewedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</span></span>}
                          <span><span className="block text-grey-500">Duration</span><span className="font-number text-sm text-grey-900">{l ? `${l.totalDays} day${l.totalDays === 1 ? "" : "s"}${l.isHalfDay ? " (half)" : ""}` : "—"}</span></span>
                          <span><span className="block text-grey-500">Type</span><span className="text-sm text-grey-900">{type} leave</span></span>
                          <span className="min-w-0 max-w-md"><span className="block text-grey-500">Reason</span><span className="block truncate text-sm text-grey-900" title={l?.reason}>{l?.reason || "—"}</span></span>
                        </div>
                      </td>
                    </tr>
                  );
                }
                const side = (which: "in" | "out") => {
                  const t = which === "in" ? r?.checkIn : r?.checkOut;
                  if (!r || !t) return <span className="text-grey-300">{r && which === "out" ? (d.status === "IN_PROGRESS" ? "At work" : "Not checked out") : "—"}</span>;
                  const keyOf = (x?: { checkInPhotoKey: string | null; checkOutPhotoKey: string | null } | null) => (which === "in" ? x?.checkInPhotoKey : x?.checkOutPhotoKey);
                  const photoId = keyOf(r) ? r.id : keyOf(photo) ? photo!.id : null;
                  return (
                    <span className="flex items-center gap-2">
                      {photoId && <AdminPhotoThumb recordId={photoId} side={which === "in" ? "checkIn" : "checkOut"} title={`${which === "in" ? "Check-in" : "Check-out"} selfie`} />}
                      <span className="font-number text-grey-900">{time(t)}</span>
                    </span>
                  );
                };
                const brk = d.breakMinutes;
                const map = r ? mapHref(r.checkInLat, r.checkInLng) : null;
                const place = r?.doorName || r?.checkInAddress;
                return (
                  <tr key={d.date} id={`day-${d.date}`} className="scroll-mt-24 hover:bg-light-600/50">
                    {dateCell}
                    <td className="whitespace-nowrap px-4 py-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", look.chip)}>{look.label}</span></td>
                    <td className="whitespace-nowrap px-4 py-3">{r ? <span className="rounded-full bg-secondary-transparent px-2.5 py-1 text-xs text-secondary">{sourceLabel(r.checkInSource)}</span> : <span className="text-grey-300">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-number text-grey-700">{brk ? hhmm(brk) : <span className="text-grey-300">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3">{side("in")}</td>
                    <td className="whitespace-nowrap px-4 py-3">{side("out")}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {d.overtimeMinutes > 0 ? (
                        <span className="flex flex-col gap-1">
                          <span className="font-number text-grey-900">{hhmm(d.overtimeMinutes)}</span>
                          {admin && d.recordId ? <OvertimeToggle recordId={d.recordId} approved={d.overtimeApproved} locked={locked(d.date)} />
                            : <span className={cn("text-xs", d.overtimeApproved ? "text-success" : "text-grey-400")}>{d.overtimeApproved ? "Approved" : "Not approved"}</span>}
                        </span>
                      ) : <span className="font-number text-grey-300">00:00</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {r?.checkOut ? <><span className="font-number text-grey-900">{hoursText(d.actualMinutes)}</span>{d.payableMinutes !== d.actualMinutes && <span className="block text-xs text-grey-500">{hoursText(d.payableMinutes)} paid</span>}</> : <span className="text-grey-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {map ? (
                        <a href={map} target="_blank" rel="noreferrer" title={place ?? undefined} className="inline-flex items-center gap-1 rounded-full bg-warning-transparent px-2.5 py-1 text-xs text-warning-900 hover:underline">
                          <MapPin className="h-3 w-3" /> View Map
                        </a>
                      ) : place ? <span className="block max-w-44 truncate text-xs text-grey-600" title={place}>{place}</span> : <span className="text-grey-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {admin && d.date <= today && <EditTimesButton employeeId={employeeId} name={employee.name} date={d.date} checkIn={hm24(d.checkIn)} checkOut={hm24(d.checkOut)}
                        label={d.status === "MISSING_CHECKOUT" || d.status === "IN_PROGRESS" ? "Add check-out" : d.checkIn ? "Edit" : "Add times"} />}
                    </td>
                  </tr>
                );
              })}
              {history.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-grey-500">Nothing in this date range yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
