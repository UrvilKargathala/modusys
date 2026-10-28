import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Clock, Download, IndianRupee, Users, Wallet } from "lucide-react";
import { getSessionUser } from "@/lib/server/require-user";
import { getPayrollEmployees, loadPayroll } from "@/lib/server/payroll-data";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { FinalizeButton } from "@/components/payroll/payroll-actions";
import { EmployeeHistoryDialog } from "@/components/payroll/employee-history-dialog";
import { statusOf } from "@/components/payroll/day-status";
import { hoursText, periodRange, sumSummaries, type PayrollSummary } from "@/lib/payroll";
import { formatInr } from "@/lib/format";
import { istDateString } from "@/lib/attendance-config";

export const dynamic = "force-dynamic";

const STATUSES = [
  ["", "All employees"],
  ["present", "Present"],
  ["absent", "Absent"],
  ["late", "Late arrivals"],
  ["early", "Early exits"],
  ["overtime", "Overtime"],
  ["setup", "Needs setup"],
] as const;
const matches = (s: PayrollSummary, status: string) =>
  status === "present" ? s.presentDays > 0
  : status === "absent" ? s.absentDays > 0
  : status === "late" ? s.lateMinutes > 0
  : status === "early" ? s.earlyMinutes > 0
  : status === "overtime" ? s.overtimeMinutes > 0
  : status === "setup" ? s.issues.length > 0
  : true;
const money = (n: number | null) => (n == null ? "—" : formatInr(n));

// Payroll dashboard: every employee's attendance and salary for a day, month or year, all from attendance records,
// each employee's own schedule and rate, holidays and approved adjustments (the same engine as the reports and CSV).
export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ view?: string; value?: string; employee?: string; status?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "super-admin") redirect("/my-attendance");
  const sp = await searchParams;
  const p = periodRange(sp.view, sp.value);
  const status = STATUSES.some(([v]) => v === sp.status) ? (sp.status ?? "") : "";

  const all = await getPayrollEmployees();
  const chosen = sp.employee ? all.filter((e) => e.id === sp.employee) : all;
  const rows = (await loadPayroll(p.from, p.to, chosen)).filter((r) => matches(r.summary, status));
  const total = sumSummaries(rows.map((r) => r.summary));
  const setupCount = rows.filter((r) => r.summary.issues.length).length;
  const monthEnded = p.view === "month" && p.to < istDateString();
  const qs = new URLSearchParams({ view: p.view, value: p.value, ...(sp.employee ? { employeeId: sp.employee } : {}) }).toString();
  const reportQs = `from=${p.from}&to=${p.to}&preset=custom`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-grey-900">Payroll</h1>
          <p className="text-sm font-body text-grey-500">Attendance, payable hours and salary per employee, from their own schedule and hourly rate.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/attendance/employees" className="rounded-md border border-grey-200 bg-card px-3 py-2 text-sm text-grey-700 hover:bg-light-600">Employees</Link>
          <a href={`/api/attendance/payroll/export?${qs}`} className="inline-flex items-center gap-1.5 rounded-md border border-grey-200 bg-card px-3 py-2 text-sm text-grey-700 hover:bg-light-600">
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-grey-100 bg-card p-3">
        <label className="flex flex-col gap-1 text-xs text-grey-500">
          View
          <select name="view" defaultValue={p.view} className="h-9 rounded-md border border-grey-200 bg-card px-2 text-sm text-grey-900">
            <option value="day">Daily</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-grey-500">
          {p.view === "day" ? "Date" : p.view === "year" ? "Year" : "Month"}
          {p.view === "day" ? (
            <input type="date" name="value" defaultValue={p.value} className="h-9 rounded-md border border-grey-200 px-2 text-sm text-grey-900" />
          ) : p.view === "year" ? (
            <input type="number" name="value" min="2020" max="2100" defaultValue={p.value} className="h-9 w-28 rounded-md border border-grey-200 px-2 text-sm text-grey-900" />
          ) : (
            <input type="month" name="value" defaultValue={p.value} className="h-9 rounded-md border border-grey-200 px-2 text-sm text-grey-900" />
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs text-grey-500">
          Employee
          <select name="employee" defaultValue={sp.employee ?? ""} className="h-9 min-w-48 rounded-md border border-grey-200 bg-card px-2 text-sm text-grey-900">
            <option value="">All employees</option>
            {all.map((e) => <option key={e.id} value={e.id}>{e.name}{e.employeeNumber ? ` (${e.employeeNumber})` : ""}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-grey-500">
          Attendance status
          <select name="status" defaultValue={status} className="h-9 rounded-md border border-grey-200 bg-card px-2 text-sm text-grey-900">
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90">Apply</button>
        <span className="ml-auto self-center font-number text-xs text-grey-500">{p.from.split("-").reverse().join("/")} – {p.to.split("-").reverse().join("/")}</span>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard compact label="Employees" value={String(rows.length)} icon={Users} accent="primary" />
        <KpiCard compact label="Expected Hours" value={hoursText(total.expectedMinutes)} icon={Clock} accent="secondary" />
        <KpiCard compact label="Payable Hours" value={hoursText(total.payableMinutes)} icon={Wallet} accent="teal" />
        <KpiCard compact label="Final Payable" value={money(total.finalSalary)} icon={IndianRupee} accent="success" />
      </div>

      {setupCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning bg-warning-transparent px-4 py-3 text-sm text-warning-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {setupCount} employee{setupCount === 1 ? " has" : "s have"} no schedule or hourly rate, so their salary is not calculated.
          <Link href="/attendance/employees" className="ml-1 font-medium underline">Set them up</Link>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-left">
            <thead>
              <tr className="bg-[var(--table-head)] text-xs font-body font-medium text-grey-900">
                {["Employee", "Present / Absent", "Scheduled Days", "Required / Day", "Expected", "Actual", "Late", "Early Exit", "Overtime (approved)", "Rate", "Earned", "Final Payable", ...(p.view === "month" ? [""] : [])].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100 text-sm">
              {rows.map(({ employee: e, summary: s, finalizedMonths, days }) => (
                <tr key={e.id} className="hover:bg-light-600/50">
                  <td className="px-3 py-2">
                    <EmployeeHistoryDialog name={e.name} code={e.employeeNumber} period={`${p.from.split("-").reverse().join("/")} – ${p.to.split("-").reverse().join("/")}`}
                      reportHref={`/attendance/reports/${e.id}?${reportQs}`}
                      // Only days that say something: no plain weekly offs, days still to come or days before joining.
                      days={days.filter((d) => d.status !== "UPCOMING" && d.status !== "BEFORE_START" && !(d.status === "OFF" && d.offReason === "WEEKLY_OFF")).map((d) => {
                        const [label, cls] = statusOf(d);
                        return { date: d.date, label, cls, checkIn: d.checkIn?.toISOString() ?? null, checkOut: d.checkOut?.toISOString() ?? null, actual: d.actualMinutes, breakMin: d.breakMinutes, payable: d.payableMinutes, late: d.lateMinutes, early: d.earlyMinutes, overtime: d.overtimeMinutes, overtimeApproved: d.overtimeApproved, rate: d.rate, earned: d.earned, overtimePay: d.overtimePay };
                      })}
                      totals={{ present: s.presentDays, absent: s.absentDays, leave: s.leaveDays, expected: s.expectedMinutes, actual: s.actualMinutes, payable: s.payableMinutes, late: s.lateMinutes, early: s.earlyMinutes, overtime: s.overtimeMinutes, approvedOvertime: s.approvedOvertimeMinutes,
                        rate: s.hourlyRate != null ? `${formatInr(s.hourlyRate)}/h` : s.issues.includes("NO_RATE") ? "Not set" : "Varies by month",
                        earned: s.earnedSalary, overtimePay: s.overtimePay, additions: s.additions, deductions: s.deductions, final: s.finalSalary }} />
                    <div className="font-number text-xs text-grey-500">{e.employeeNumber ?? "No ID"}</div>
                    {s.issues.length > 0 && <div className="mt-0.5 text-xs text-error">{s.issues.map((i) => (i === "NO_RATE" ? "No hourly rate" : "No schedule")).join(" · ")}</div>}
                    {finalizedMonths.length > 0 && <div className="mt-0.5 text-xs text-success">Finalized {finalizedMonths.join(", ")}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-number">{s.presentDays} / <span className={s.absentDays ? "text-error" : ""}>{s.absentDays}</span>{s.leaveDays ? <span className="text-xs text-grey-500"> · {s.leaveDays} leave</span> : null}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-number">{s.scheduledDays}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-number">{hoursText(s.requiredDailyMinutes)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-number">{hoursText(s.expectedMinutes)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-number">{hoursText(s.actualMinutes)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-number">{s.lateMinutes ? <span className="text-warning-900">{s.lateMinutes} min · {s.lateDays}d</span> : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-number">{s.earlyMinutes ? <span className="text-warning-900">{s.earlyMinutes} min · {s.earlyDays}d</span> : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-number">{s.overtimeMinutes ? `${hoursText(s.overtimeMinutes)} (${hoursText(s.approvedOvertimeMinutes)})` : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-number">{s.hourlyRate != null ? formatInr(s.hourlyRate) : s.issues.includes("NO_RATE") ? "—" : <span className="text-xs text-grey-500">Varies by month</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-number">{money(s.earnedSalary)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-number text-base font-semibold text-grey-900">{money(s.finalSalary)}</td>
                  {p.view === "month" && (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <FinalizeButton employeeId={e.id} period={p.value} finalized={finalizedMonths.includes(p.value)}
                        disabled={!monthEnded ? "A month can be finalized once it has ended" : s.issues.length ? "Set a schedule and hourly rate first" : undefined} />
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-grey-500">No employees match these filters.</td></tr>
              )}
            </tbody>
            {rows.length > 1 && (
              <tfoot>
                <tr className="bg-light-600 text-sm font-semibold text-grey-900">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 font-number">{total.presentDays} / {total.absentDays}</td>
                  <td className="px-3 py-2 font-number">{total.scheduledDays}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 font-number">{hoursText(total.expectedMinutes)}</td>
                  <td className="px-3 py-2 font-number">{hoursText(total.actualMinutes)}</td>
                  <td className="px-3 py-2 font-number">{total.lateMinutes} min</td>
                  <td className="px-3 py-2 font-number">{total.earlyMinutes} min</td>
                  <td className="px-3 py-2 font-number">{hoursText(total.overtimeMinutes)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 font-number">{money(total.earnedSalary)}</td>
                  <td className="px-3 py-2 font-number">{money(total.finalSalary)}</td>
                  {p.view === "month" && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
      <p className="text-xs text-grey-500">
        Payable hours are worked hours (after the unpaid break) up to each day&apos;s required hours, so late arrival and early exit time is not paid and never deducted twice.
        All overtime is approved by default; untick a day on the employee&apos;s report to stop paying it. Totals with a missing rate show “—”.
      </p>
    </div>
  );
}
