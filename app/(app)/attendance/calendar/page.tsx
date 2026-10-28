import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock, Hourglass, IndianRupee, LogOut, MapPin, Pencil, TimerOff, UserCheck, Wallet, Zap } from "lucide-react";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { getPayrollEmployees, loadPayroll, toPayrollEmployee } from "@/lib/server/payroll-data";
import { istDateString } from "@/lib/attendance-config";
import { WEEKDAYS, hoursText, istMinuteOfDay, scheduleOf, sumSummaries, type PayrollDay } from "@/lib/payroll";
import { formatInr } from "@/lib/format";
import { statusOf } from "@/components/payroll/day-status";
import { EditTimesButton } from "@/components/payroll/attendance-time-dialogs";
import { CalendarDayCell } from "@/components/payroll/calendar-day-cell";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type View = "day" | "week" | "month";
const VIEWS: View[] = ["day", "week", "month"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => { const d = utc(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const addMonths = (s: string, n: number) => { const d = utc(s.slice(0, 7) + "-01"); d.setUTCMonth(d.getUTCMonth() + n); return ymd(d); };
const weekday = (s: string) => utc(s).getUTCDay();
const monthEnd = (s: string) => { const d = utc(s.slice(0, 7) + "-01"); d.setUTCMonth(d.getUTCMonth() + 1, 0); return ymd(d); };
const time = (d: Date | null) => (d ? d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }) : "…");
const dmy = (s: string) => s.split("-").reverse().join("/");
const hm24 = (d: Date | null) => (d ? `${String(Math.floor(istMinuteOfDay(d) / 60)).padStart(2, "0")}:${String(istMinuteOfDay(d) % 60).padStart(2, "0")}` : "");
// What the edit button says: the missing piece first.
const fixLabel = (d: PayrollDay) => (d.status === "MISSING_CHECKOUT" || d.status === "IN_PROGRESS" ? "Add check-out" : d.checkIn ? "Edit times" : "Add times");
const clock12 = (s: string | null) => {
  if (!s) return "—";
  const [h, m] = s.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
// Days that say something about attendance (worked, absent, leave). Plain offs and future days stay empty, as on a calendar.
const shown = (d: PayrollDay) => d.status !== "UPCOMING" && d.status !== "OFF" && d.status !== "BEFORE_START";
const worked = (d: PayrollDay) => d.checkIn != null;

// The day timeline runs 6 AM – 11 PM.
const T0 = 6 * 60, T1 = 23 * 60;
const pct = (m: number) => `${Math.min(100, Math.max(0, ((m - T0) / (T1 - T0)) * 100))}%`;

// Attendance calendar: every employee's day as calendar entries (check-in / check-out time, hours, place), in Day, Week,
// Month and Year views like a desktop calendar. All numbers come from the payroll engine, so they match Payroll and Reports.
export default async function AttendanceCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; employee?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "super-admin") redirect("/my-attendance");
  const sp = await searchParams;
  const today = istDateString();
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "month";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;

  // The period in focus, and the (possibly wider) range drawn: a month grid starts on Sunday and ends on Saturday.
  const focus =
    view === "day" ? { from: date, to: date }
    : view === "week" ? { from: addDays(date, -weekday(date)), to: addDays(date, 6 - weekday(date)) }
    : { from: date.slice(0, 7) + "-01", to: monthEnd(date) };
  const range = view === "month" ? { from: addDays(focus.from, -weekday(focus.from)), to: addDays(focus.to, 6 - weekday(focus.to)) } : focus;
  const step = (n: number) => (view === "day" ? addDays(date, n) : view === "week" ? addDays(date, 7 * n) : addMonths(date, n));

  const all = await getPayrollEmployees();
  // One employee at a time (their own calendar), picked from the tickets.
  const selectedId = all.some((e) => e.id === sp.employee) ? sp.employee! : all[0]?.id;
  const chosen = selectedId ? all.filter((e) => e.id === selectedId) : all;
  const selected = selectedId ? chosen[0] : undefined;
  const [pay, focusPay, holidays, places] = await Promise.all([
    loadPayroll(range.from, range.to, chosen),
    range.from === focus.from && range.to === focus.to ? null : loadPayroll(focus.from, focus.to, chosen),
    prisma.holiday.findMany({ where: { date: { gte: utc(range.from), lte: utc(range.to) } } }),
    prisma.attendanceRecord.findMany({
      where: { employeeId: { in: chosen.map((e) => e.id) }, date: { gte: utc(range.from), lte: utc(range.to) } },
      select: { id: true, checkInAddress: true, checkOutAddress: true, doorName: true, checkOutDoorName: true },
    }),
  ]);
  const placeOf = new Map(places.map((p) => [p.id, p]));
  const holidayOn = new Map(holidays.map((h) => [ymd(h.date), h.name]));
  const byDate = new Map<string, { name: string; id: string; day: PayrollDay; sched: boolean }[]>();
  for (const p of pay) for (const day of p.days) {
    const list = byDate.get(day.date) ?? [];
    list.push({ name: p.employee.name, id: p.employee.id, day, sched: !p.summary.issues.includes("NO_SCHEDULE") });
    byDate.set(day.date, list);
  }
  const entriesOn = (d: string) => (byDate.get(d) ?? []).filter((e) => shown(e.day)).sort((a, b) => Number(worked(b.day)) - Number(worked(a.day)) || (a.day.checkIn?.getTime() ?? 0) - (b.day.checkIn?.getTime() ?? 0));

  // Totals for the focus period only (not the neighbouring days a month grid shows), same engine as Payroll.
  const t = sumSummaries((focusPay ?? pay).map((p) => p.summary));

  const href = (v: View, d: string, emp = selectedId) => `/attendance/calendar?view=${v}&date=${d}${emp ? `&employee=${emp}` : ""}`;
  const sel = selected ? toPayrollEmployee(selected) : null;
  const selSch = sel ? scheduleOf(sel) : null;
  const title =
    view === "day" ? <>{utc(date).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long" })} <span className="font-light">{dmy(date)}</span></>
    : view === "week" ? <>{[...new Set([focus.from, focus.to].map((d) => MONTHS[Number(d.slice(5, 7)) - 1]))].join(" – ")} <span className="font-light">{dmy(focus.from)} – {dmy(focus.to)}</span></>
    : view === "month" ? <>{MONTHS[Number(date.slice(5, 7)) - 1]} <span className="font-light">{date.slice(0, 4)}</span></>
    : <>{date.slice(0, 4)}</>;

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Employee tickets: pick whose calendar to see; each shows their working hours so there's no need to look them up. */}
      <aside className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0">
        <p className="hidden px-1 text-xs font-semibold uppercase tracking-wider text-grey-500 lg:block">Employees</p>
        {all.map((e) => {
          const pe = toPayrollEmployee(e);
          const sch = scheduleOf(pe);
          const on = e.id === selectedId;
          // The ticket picks whose calendar to show; the arrow in its corner opens their full report (a sibling link, not nested).
          return (
            <div key={e.id} className="relative min-w-52 shrink-0 lg:min-w-0">
            <Link href={href(view, date, e.id)}
              className={cn("block rounded-xl border p-3 pr-9 backdrop-blur-md transition-colors", on ? "border-primary bg-white/75 ring-2 ring-primary/20" : "border-white/60 bg-white/40 hover:bg-white/60")}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-sm font-semibold", on ? "text-primary" : "text-grey-900")}>{e.name}</span>
                <span className="shrink-0 font-number text-[11px] text-grey-500">{e.employeeNumber ?? ""}</span>
              </div>
              <div className="my-2 border-t border-dashed border-grey-200" />
              <div className="flex items-center gap-1.5 text-xs text-grey-700">
                <Clock className="h-3.5 w-3.5 shrink-0 text-grey-400" />
                {sch ? <span className="font-number">{clock12(pe.scheduleStart)} – {clock12(pe.scheduleEnd)}</span> : <span className="text-warning-900">No schedule set</span>}
              </div>
              <div className="mt-1 text-[11px] text-grey-500">
                {sch ? `${hoursText(sch.required)} / day · ` : ""}Off {pe.weeklyOffDays.length ? pe.weeklyOffDays.map((d) => WEEKDAYS[d]).join(", ") : "none"}{pe.monthlySalary != null ? ` · ${formatInr(pe.monthlySalary)}/mo` : pe.hourlyRate != null ? ` · ${formatInr(pe.hourlyRate)}/h` : ""}
              </div>
            </Link>
            <Link href={`/attendance/reports/${e.id}?from=${focus.from}&to=${focus.to}&preset=custom`} title={`Open ${e.name}'s report`} aria-label={`Open ${e.name}'s report`}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-grey-400 transition-colors hover:bg-primary hover:text-white">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            </div>
          );
        })}
      </aside>

      <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold text-grey-900">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-light-600 p-0.5">
            {VIEWS.map((v) => (
              <Link key={v} href={href(v, date)} className={cn("rounded-md px-3 py-1 text-xs font-body font-medium capitalize transition-colors", v === view ? "bg-card text-primary shadow-sm" : "text-grey-400 hover:text-grey-700")}>{v}</Link>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Link href={href(view, step(-1))} aria-label="Previous" className="rounded-md border border-grey-200 bg-card p-1.5 text-grey-600 hover:bg-light-600"><ChevronLeft className="h-4 w-4" /></Link>
            <Link href={href(view, today)} className="rounded-md border border-grey-200 bg-card px-3 py-1 text-sm text-grey-700 hover:bg-light-600">Today</Link>
            <Link href={href(view, step(1))} aria-label="Next" className="rounded-md border border-grey-200 bg-card p-1.5 text-grey-600 hover:bg-light-600"><ChevronRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>

      {sel && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/60 bg-white/50 px-4 py-3 text-sm backdrop-blur-md">
          <div>
            <Link href={`/attendance/reports/${sel.id}?from=${focus.from}&to=${focus.to}&preset=custom`} className="group inline-flex items-center gap-1 font-heading text-base font-semibold text-grey-900 hover:text-primary">
              {sel.name} <ArrowUpRight className="h-4 w-4 text-grey-400 group-hover:text-primary" />
            </Link>
            <p className="text-xs text-grey-500">{[sel.employeeNumber, selected?.designation, selected?.department].filter(Boolean).join(" · ") || "Employee"}</p>
          </div>
          {[
            ["Timing", selSch ? `${clock12(sel.scheduleStart)} – ${clock12(sel.scheduleEnd)}` : "Not set"],
            ["Required / day", selSch ? hoursText(selSch.required) : "—"],
            ["Unpaid break", sel.breakMinutes ? `${sel.breakMinutes} min` : "None"],
            ["Late after", selSch ? clock12(`${String(Math.floor((selSch.start + (sel.lateGraceMinutes ?? 0)) / 60)).padStart(2, "0")}:${String((selSch.start + (sel.lateGraceMinutes ?? 0)) % 60).padStart(2, "0")}`) : "—"],
            ["Weekly off", sel.weeklyOffDays.length ? sel.weeklyOffDays.map((d) => WEEKDAYS[d]).join(", ") : "None"],
            [sel.monthlySalary != null ? "Monthly salary" : "Hourly rate", sel.monthlySalary != null ? formatInr(sel.monthlySalary) : sel.hourlyRate != null ? formatInr(sel.hourlyRate) : "Not set"],
            ["Overtime", sel.overtimeEnabled ? `Paid × ${sel.overtimeMultiplier ?? 1}` : "Not paid"],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] text-grey-500">{k}</p>
              <p className={cn("font-number font-medium", v === "Not set" ? "text-warning-900" : "text-grey-900")}>{v}</p>
            </div>
          ))}
          <Link href="/attendance/employees" className="ml-auto inline-flex items-center gap-1 rounded-md border border-grey-200 bg-card px-2.5 py-1.5 text-xs text-grey-700 hover:bg-light-600">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard compact label="Worked / Expected" value={`${hoursText(t.actualMinutes)} / ${hoursText(t.expectedMinutes)}`} icon={Clock} accent="primary" />
        <KpiCard compact label="Payable Hours" value={hoursText(t.payableMinutes)} icon={Hourglass} accent="teal" />
        <KpiCard compact label="Present · Absent · Leave" value={`${t.presentDays} · ${t.absentDays} · ${t.leaveDays}`} icon={UserCheck} accent="success" />
        <KpiCard compact label="Late Arrivals" value={`${t.lateMinutes}m · ${t.lateDays} day${t.lateDays === 1 ? "" : "s"}`} icon={TimerOff} accent="warning" />
        <KpiCard compact label="Early Exits" value={`${t.earlyMinutes}m · ${t.earlyDays} day${t.earlyDays === 1 ? "" : "s"}`} icon={LogOut} accent="orange" />
        <KpiCard compact label={`Overtime · ${hoursText(t.approvedOvertimeMinutes)} approved`} value={`${hoursText(t.overtimeMinutes)} · ${t.overtimePay == null ? "—" : formatInr(t.overtimePay)}`} icon={Zap} accent="info" />
        <KpiCard compact label="Earned Salary" value={t.earnedSalary == null ? "—" : formatInr(t.earnedSalary)} icon={Wallet} accent="secondary" />
        <KpiCard compact label="Final Payable" value={t.finalSalary == null ? "—" : formatInr(t.finalSalary)} icon={IndianRupee} accent="success" />
      </div>

      {view === "month" && (
        <Card className="overflow-x-auto p-0">
          <div className="grid grid-cols-[repeat(7,minmax(130px,1fr))] gap-1.5 px-2 pt-2">
            {DAYS.map((d) => <div key={d} className="px-2 py-2 text-right text-xs font-medium text-grey-500">{d}</div>)}
          </div>
          <div className="grid grid-cols-[repeat(7,minmax(130px,1fr))] gap-1.5 p-2">
            {Array.from({ length: (utc(range.to).getTime() - utc(range.from).getTime()) / 86_400_000 + 1 }, (_, i) => addDays(range.from, i)).map((d) => {
              const day = d >= focus.from && d <= focus.to ? byDate.get(d)?.[0]?.day : undefined;
              if (!day || !selected) {
                return (
                  <div key={d} className={cn("flex h-[110px] justify-end rounded-xl border border-white/40 bg-white/15 p-1.5", weekday(d) === 0 && "border-grey-100/60 bg-grey-100/40")}>
                    <span className="font-number text-[10px] font-semibold text-grey-300">{Number(d.slice(8))}{d.slice(8) === "01" ? ` ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}` : ""}</span>
                  </div>
                );
              }
              const [label, cls] = statusOf(day);
              const quiet = day.status === "UPCOMING" || day.status === "BEFORE_START";
              const place = day.recordId ? placeOf.get(day.recordId) : undefined;
              return (
                <CalendarDayCell key={d} d={{
                  date: d,
                  title: `${DAYS[weekday(d)]} ${dmy(d)}`,
                  isToday: d === today,
                  muted: day.status === "OFF",
                  label: quiet ? null : day.lateMinutes > 0 && day.status === "PRESENT" ? "Late" : label,
                  cls,
                  holiday: day.status === "OFF" ? null : (holidayOn.get(d) ?? null),
                  shiftTime: day.scheduled && selSch ? `${clock12(sel!.scheduleStart).toLowerCase()} - ${clock12(sel!.scheduleEnd).toLowerCase()}` : null,
                  // Check-in → check-out is compared with the shift's own start → end, both plain clock time.
                  shiftHours: day.scheduled && selSch ? hoursText(selSch.end - selSch.start) : null,
                  diff: day.scheduled && selSch && day.checkOut ? day.actualMinutes - (selSch.end - selSch.start) : null,
                  workedMinutes: day.checkOut ? day.actualMinutes : null,
                  shiftMinutes: day.scheduled && selSch ? selSch.end - selSch.start : null,
                  checkIn: day.checkIn ? time(day.checkIn) : null,
                  checkOut: day.checkOut ? time(day.checkOut) : null,
                  checkInPlace: place?.doorName || place?.checkInAddress || null,
                  checkOutPlace: place?.checkOutDoorName || place?.checkOutAddress || null,
                  worked: day.checkOut ? hoursText(day.actualMinutes) : null,
                  payable: day.checkOut && day.payableMinutes !== day.actualMinutes ? hoursText(day.payableMinutes) : null,
                  late: day.lateMinutes,
                  early: day.earlyMinutes,
                  overtime: day.overtimeMinutes > 0 ? hoursText(day.overtimeMinutes) : null,
                  overtimeApproved: day.overtimeApproved,
                  missingOut: day.status === "MISSING_CHECKOUT",
                  reportHref: `/attendance/reports/${selected.id}?from=${d}&to=${d}&preset=custom`,
                  dayHref: href("day", d),
                  edit: d <= today && !quiet ? { employeeId: selected.id, name: selected.name, checkIn: hm24(day.checkIn), checkOut: hm24(day.checkOut), label: fixLabel(day) } : null,
                }} />
              );
            })}
          </div>
        </Card>
      )}

      {view === "week" && (
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[980px] grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => addDays(focus.from, i)).map((d) => (
              <div key={d} className="flex min-h-80 flex-col gap-1.5 border-r border-grey-100 p-2 last:border-r-0">
                <Link href={href("day", d)} className="flex items-baseline justify-between border-b border-grey-100 pb-1.5">
                  <span className="text-xs font-medium text-grey-500">{DAYS[weekday(d)]}</span>
                  <span className={cn("flex h-7 min-w-7 items-center justify-center rounded-full font-number text-base", d === today ? "bg-primary text-white" : "text-grey-900")}>{Number(d.slice(8))}</span>
                </Link>
                {holidayOn.get(d) && <span className="truncate rounded bg-teal-transparent px-1.5 py-0.5 text-[11px] text-teal">{holidayOn.get(d)}</span>}
                {entriesOn(d).map((e) => {
                  const [label, cls] = statusOf(e.day);
                  const place = e.day.recordId ? placeOf.get(e.day.recordId) : undefined;
                  return (
                    <Link key={e.id} href={`/attendance/reports/${e.id}?from=${d}&to=${d}&preset=custom`} className={cn("flex flex-col rounded-md px-2 py-1.5 text-[11px] leading-4", cls)}>
                      <span className="truncate font-semibold">{e.name}</span>
                      {worked(e.day) ? (
                        <>
                          <span className="font-number">{time(e.day.checkIn)} – {e.day.checkOut ? time(e.day.checkOut) : "…"}</span>
                          <span className="font-number">{hoursText(e.day.actualMinutes)}{e.day.lateMinutes ? ` · ${e.day.lateMinutes}m late` : ""}{e.day.earlyMinutes ? ` · ${e.day.earlyMinutes}m early` : ""}</span>
                          {(place?.doorName || place?.checkInAddress) && <span className="truncate opacity-80">{place.doorName || place.checkInAddress}</span>}
                        </>
                      ) : <span>{label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      )}

      {view === "day" && (
        <Card className="overflow-x-auto p-0">
          {holidayOn.get(date) && <div className="border-b border-grey-100 bg-teal-transparent px-4 py-2 text-sm text-teal">{holidayOn.get(date)}</div>}
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="bg-[var(--table-head)] text-xs font-medium text-grey-900">
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Status</th>
                <th className="w-[34%] px-3 py-2">
                  <div>Time in office</div>
                  {/* Hour marks sit exactly over the grid lines in each row's bar. */}
                  <div className="relative mt-1 h-4 font-number text-[11px] font-normal text-grey-500">
                    {[6, 9, 12, 15, 18, 21].map((h) => (
                      <span key={h} className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0" style={{ left: pct(h * 60) }}>{((h + 11) % 12) + 1} {h < 12 ? "AM" : "PM"}</span>
                    ))}
                  </div>
                </th>
                <th className="px-3 py-2">Check In</th>
                <th className="px-3 py-2">Check Out</th>
                <th className="px-3 py-2">Worked / Payable</th>
                <th className="px-3 py-2">Late / Early</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {(byDate.get(date) ?? []).sort((a, b) => Number(worked(b.day)) - Number(worked(a.day)) || a.name.localeCompare(b.name)).map((e) => {
                const [label, cls] = statusOf(e.day);
                const place = e.day.recordId ? placeOf.get(e.day.recordId) : undefined;
                const inMin = e.day.checkIn ? istMinuteOfDay(e.day.checkIn) : null;
                const outMin = e.day.checkOut ? istMinuteOfDay(e.day.checkOut) : e.day.status === "IN_PROGRESS" ? istMinuteOfDay(new Date()) : inMin;
                return (
                  <tr key={e.id} className="align-top hover:bg-light-600/50">
                    <td className="px-3 py-2.5"><Link href={`/attendance/reports/${e.id}?from=${date}&to=${date}&preset=custom`} className="font-medium text-grey-900 hover:text-primary">{e.name}</Link></td>
                    <td className="px-3 py-2.5"><span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", cls)}>{label}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="relative h-6 rounded bg-light-600">
                        {[9, 12, 15, 18, 21].map((h) => <span key={h} className="absolute inset-y-0 w-px bg-grey-100" style={{ left: pct(h * 60) }} />)}
                        {inMin != null && outMin != null && (
                          <span title={`${time(e.day.checkIn)} – ${e.day.checkOut ? time(e.day.checkOut) : "now"}`}
                            className={cn("absolute inset-y-0.5 min-w-1 rounded", e.day.lateMinutes ? "bg-warning" : e.day.status === "IN_PROGRESS" ? "bg-info" : "bg-success")}
                            style={{ left: pct(inMin), width: `calc(${pct(outMin)} - ${pct(inMin)})` }} />
                        )}
                        {inMin == null && <span className="absolute inset-0 flex items-center justify-center text-[11px] text-grey-400">{label === "Upcoming" ? "Not yet" : `No check-in · ${label}`}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-number text-grey-900">{e.day.checkIn ? time(e.day.checkIn) : "—"}</div>
                      {(place?.doorName || place?.checkInAddress) && <div className="flex max-w-56 items-start gap-1 text-xs text-grey-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="truncate" title={place.checkInAddress ?? ""}>{place.doorName || place.checkInAddress}</span></div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-number text-grey-900">{e.day.checkOut ? time(e.day.checkOut) : e.day.checkIn ? "Not checked out" : "—"}</div>
                      {(place?.checkOutDoorName || place?.checkOutAddress) && <div className="flex max-w-56 items-start gap-1 text-xs text-grey-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="truncate" title={place.checkOutAddress ?? ""}>{place.checkOutDoorName || place.checkOutAddress}</span></div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-number">{worked(e.day) ? <>{hoursText(e.day.actualMinutes)} <span className="text-grey-400">/</span> <span className="font-semibold">{e.sched ? hoursText(e.day.payableMinutes) : "—"}</span></> : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {e.day.lateMinutes > 0 && <div className="text-warning-900">Late {e.day.lateMinutes}m</div>}
                      {e.day.earlyMinutes > 0 && <div className="text-warning-900">Early {e.day.earlyMinutes}m</div>}
                      {e.day.overtimeMinutes > 0 && <div className="text-purple">Overtime {hoursText(e.day.overtimeMinutes)}</div>}
                      {!e.day.lateMinutes && !e.day.earlyMinutes && !e.day.overtimeMinutes && <span className="text-grey-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      {date <= today && e.day.status !== "BEFORE_START" && <EditTimesButton employeeId={e.id} name={e.name} date={date} checkIn={hm24(e.day.checkIn)} checkOut={hm24(e.day.checkOut)} label={fixLabel(e.day)} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-4 border-t border-grey-100 px-4 py-2.5 text-xs text-grey-500">
            <span>Each bar runs from check-in to check-out (hover it for the exact times).</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-success" /> On time</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-warning" /> Came late</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-info" /> Still at work</span>
          </div>
        </Card>
      )}

      </div>
    </div>
  );
}
