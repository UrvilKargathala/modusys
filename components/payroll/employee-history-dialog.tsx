"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, History } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type HistoryDay = {
  recordId: string | null;
  realIn: string | null; // as clocked
  realOut: string | null;
  editedIn: boolean; // a super admin changed it
  editedOut: boolean;
  date: string;
  label: string;
  cls: string;
  checkIn: string | null; // ISO, the time pay is counted on (edited if edited)
  checkOut: string | null;
  actual: number;
  breakMin: number;
  payable: number;
  late: number;
  early: number;
  overtime: number;
  overtimeApproved: boolean;
  rate: number | null;
  earned: number | null;
  realEarned: number | null;
  overtimePay: number | null;
};
export type HistoryTotals = {
  present: number; absent: number; leave: number; expected: number | null; actual: number; payable: number; late: number; early: number; overtime: number; approvedOvertime: number;
  rate: string; earned: number | null; overtimePay: number | null; additions: number; deductions: number; final: number | null;
};

const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }) : "—");
const span = (a: string | null, b: string | null) => (a && b && b > a ? Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 60_000) : 0);
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "");
const inr = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const day = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short" });

// The day-by-day list behind one Payroll row, so its totals can be counted and checked without leaving the page.
// The footer adds the same days up and matches the row.
// Round each day to the paisa and put any leftover paisa on the biggest day, so the column adds up to the exact total.
function roundedColumn(values: (number | null)[], total: number | null): (number | null)[] {
  const out = values.map((v) => (v == null ? null : Math.round(v * 100) / 100));
  if (total == null) return out;
  const gap = Math.round((total - out.reduce<number>((n, v) => n + (v ?? 0), 0)) * 100) / 100;
  if (gap) {
    let big = -1;
    out.forEach((v, i) => { if (v && (big < 0 || v > out[big]!)) big = i; });
    if (big >= 0) out[big] = Math.round((out[big]! + gap) * 100) / 100;
  }
  return out;
}

// One editable time (IST) for the Edit In / Edit Out columns. Starts as the real time; putting the real time back (or clearing it) removes the edit.
function TimeCell({ recordId, field, value, real, edited, schedule, onError }: { recordId: string; field: "editCheckIn" | "editCheckOut"; value: string | null; real: string | null; edited: boolean; schedule: string | null; onError: (m: string) => void }) {
  const router = useRouter();
  const shown = hhmm(value);
  async function save(input: HTMLInputElement, t: string) {
    if (t === shown) return;
    onError("");
    const res = await fetch("/api/attendance/payroll/edit-times", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordId, [field]: t === hhmm(real) ? null : t }) });
    if (!res.ok) { onError((await res.json().catch(() => null))?.error ?? "Could not save"); input.value = shown; return; }
    router.refresh();
  }
  return (
    <input
      key={shown}
      type="time"
      defaultValue={shown}
      aria-label={field === "editCheckIn" ? "Edit in" : "Edit out"}
      className={cn("h-7 rounded-md border bg-card px-1.5 font-number text-sm", edited ? "border-primary text-primary" : "border-grey-100 text-grey-900")}
      title={schedule ? `Double-click to use the schedule time (${schedule})` : undefined}
      onDoubleClick={(e) => { if (schedule) { e.currentTarget.value = schedule; void save(e.currentTarget, schedule); } }}
      onBlur={(e) => {
        if (e.target.validity.badInput) { e.target.value = shown; return; } // half-typed time: keep the saved one
        void save(e.target, e.target.value);
      }}
    />
  );
}

export function EmployeeHistoryDialog({ name, code, period, reportHref, scheduleIn, scheduleOut, days: raw, totals }: { name: string; code: string | null; period: string; reportHref: string; scheduleIn: string | null; scheduleOut: string | null; days: HistoryDay[]; totals: HistoryTotals }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const earned = roundedColumn(raw.map((d) => d.earned), totals.earned);
  // Rounded the same way as Edited Earned, so a day with no edit shows the same amount in both columns.
  const realEarned = roundedColumn(raw.map((d) => d.realEarned), totals.earned == null ? null : Math.round(raw.reduce((n, d) => n + (d.realEarned ?? 0), 0) * 100) / 100);
  const otPay = roundedColumn(raw.map((d) => d.overtimePay), totals.overtimePay);
  const days = raw.map((d, i) => ({ ...d, earned: earned[i], realEarned: realEarned[i], overtimePay: otPay[i] }));
  const realTotal = days.reduce((n, d) => n + span(d.realIn, d.realOut), 0);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group inline-flex items-center gap-1 text-left text-grey-900 hover:text-primary" title="Show day-by-day history">
        {name} <History className="h-3.5 w-3.5 text-grey-400 group-hover:text-primary" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] w-[96vw] flex-col gap-3 sm:max-w-[1500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {name}{code && <span className="font-number text-sm font-normal text-grey-500">{code}</span>}
            </DialogTitle>
            <DialogDescription>Attendance history · {period}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Present · Absent · Leave", `${totals.present} · ${totals.absent} · ${totals.leave}`],
              ["Expected", totals.expected == null ? "—" : hm(totals.expected)],
              ["Actual · Edit Actual", `${hm(realTotal)} · ${hm(totals.actual)}`],
              ["Late · Early", `${totals.late}m · ${totals.early}m`],
              ["Overtime (approved)", `${hm(totals.overtime)} (${hm(totals.approvedOvertime)})`],
              ["Rate", totals.rate],
              ["Final Payable", inr(totals.final)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-grey-100 bg-card px-3 py-2">
                <p className="text-[11px] text-grey-500">{k}</p>
                <p className="font-number text-sm font-semibold text-grey-900">{v}</p>
              </div>
            ))}
          </div>
          {err && <p className="text-sm text-error">{err}</p>}
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-grey-100">
            <table className="w-full min-w-[1400px] text-left text-sm">
              <thead className="sticky top-0 bg-light-600 text-xs text-grey-500">
                <tr>{["Date", "Status", "Actual In", "Actual Out", "Actual", "Edit In", "Edit Out", "Edit Actual", "Payable", "Late", "Early", "Overtime", "Rate", "Actual Earned", "Edited Earned", "OT Pay", "Day Total"].map((h) => <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-grey-100">
                {days.map((d) => (
                  <tr key={d.date} className="hover:bg-light-600/50">
                    <td className="whitespace-nowrap px-2 py-1.5 font-number text-grey-900">{day(d.date)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", d.cls)}>{d.label}</span></td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{time(d.realIn)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.realIn && !d.realOut ? <span className="text-error">—</span> : time(d.realOut)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{span(d.realIn, d.realOut) ? hm(span(d.realIn, d.realOut)) : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{d.recordId ? <TimeCell recordId={d.recordId} field="editCheckIn" value={d.checkIn} real={d.realIn} edited={d.editedIn} schedule={scheduleIn} onError={setErr} /> : <span className="text-grey-300">—</span>}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{d.recordId ? <TimeCell recordId={d.recordId} field="editCheckOut" value={d.checkOut} real={d.realOut} edited={d.editedOut} schedule={scheduleOut} onError={setErr} /> : <span className="text-grey-300">—</span>}</td>
                    <td className={cn("whitespace-nowrap px-2 py-1.5 font-number", d.editedIn || d.editedOut ? "text-primary" : "")}>{d.actual ? hm(d.actual) : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.payable ? hm(d.payable) : "—"}</td>
                    <td className={cn("whitespace-nowrap px-2 py-1.5 font-number", d.late ? "text-orange" : "text-grey-300")}>{d.late ? `${d.late}m` : "—"}</td>
                    <td className={cn("whitespace-nowrap px-2 py-1.5 font-number", d.early ? "text-warning-900" : "text-grey-300")}>{d.early ? `${d.early}m` : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.overtime ? <span className={d.overtimeApproved ? "text-purple" : "text-grey-500"}>{hm(d.overtime)}{d.overtimeApproved ? " ✓" : ""}</span> : <span className="text-grey-300">—</span>}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number text-grey-500">{d.rate == null ? "—" : inr(d.rate)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number text-grey-500">{d.realEarned ? inr(d.realEarned) : <span className="text-grey-300">—</span>}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.earned ? inr(d.earned) : <span className="text-grey-300">—</span>}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.overtimePay ? <span className="text-purple">{inr(d.overtimePay)}</span> : <span className="text-grey-300">—</span>}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number font-semibold text-grey-900">{d.earned || d.overtimePay ? inr((d.earned ?? 0) + (d.overtimePay ?? 0)) : <span className="font-normal text-grey-300">—</span>}</td>
                  </tr>
                ))}
                {days.length === 0 && <tr><td colSpan={17} className="px-3 py-8 text-center text-grey-500">Nothing in this period yet.</td></tr>}
              </tbody>
              <tfoot className="sticky bottom-0 bg-light-600 text-sm font-semibold text-grey-900">
                <tr>
                  <td className="px-2 py-2" colSpan={4}>Total · {days.length} days</td>
                  <td className="px-2 py-2 font-number">{hm(realTotal)}</td>
                  <td className="px-2 py-2" colSpan={2} />
                  <td className="px-2 py-2 font-number">{hm(totals.actual)}</td>
                  <td className="px-2 py-2 font-number">{hm(totals.payable)}</td>
                  <td className="px-2 py-2 font-number">{totals.late}m</td>
                  <td className="px-2 py-2 font-number">{totals.early}m</td>
                  <td className="px-2 py-2 font-number">{hm(totals.overtime)}</td>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 font-number text-grey-500">{totals.earned == null ? "—" : inr(days.reduce((n, d) => n + (d.realEarned ?? 0), 0))}</td>
                  <td className="px-2 py-2 font-number">{inr(totals.earned)}</td>
                  <td className="px-2 py-2 font-number">{inr(totals.overtimePay)}</td>
                  <td className="px-2 py-2 font-number">{totals.earned == null ? "—" : inr(totals.earned + (totals.overtimePay ?? 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Month additions / deductions aren't tied to a day, so they join here: the result is the Payroll row's Final Payable. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary-transparent px-4 py-2.5">
            <p className="font-number text-sm text-grey-700">
              {inr(totals.earned)} earned<span className="text-grey-400"> + </span>{inr(totals.overtimePay)} overtime
              <span className="text-grey-400"> + </span><span className={totals.additions ? "text-success" : ""}>{inr(totals.additions)}</span> additions
              <span className="text-grey-400"> − </span><span className={totals.deductions ? "text-error" : ""}>{inr(totals.deductions)}</span> deductions
              <span className="text-grey-400"> = </span><span className="text-base font-semibold text-primary">{inr(totals.final)}</span>
            </p>
            <span className="text-[11px] text-grey-500">Additions and deductions are for the whole month, so they are added here.</span>
          </div>
          <div className="flex justify-end">
            <Link href={reportHref} className="inline-flex items-center gap-1 text-sm font-medium text-secondary hover:underline">Open full report <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
