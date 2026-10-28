"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, History } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type HistoryDay = {
  date: string;
  label: string;
  cls: string;
  checkIn: string | null; // ISO
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
  overtimePay: number | null;
};
export type HistoryTotals = {
  present: number; absent: number; leave: number; expected: number | null; actual: number; payable: number; late: number; early: number; overtime: number; approvedOvertime: number;
  rate: string; earned: number | null; overtimePay: number | null; additions: number; deductions: number; final: number | null;
};

const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }) : "—");
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

export function EmployeeHistoryDialog({ name, code, period, reportHref, days: raw, totals }: { name: string; code: string | null; period: string; reportHref: string; days: HistoryDay[]; totals: HistoryTotals }) {
  const [open, setOpen] = useState(false);
  const earned = roundedColumn(raw.map((d) => d.earned), totals.earned);
  const otPay = roundedColumn(raw.map((d) => d.overtimePay), totals.overtimePay);
  const days = raw.map((d, i) => ({ ...d, earned: earned[i], overtimePay: otPay[i] }));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group inline-flex items-center gap-1 text-left text-grey-900 hover:text-primary" title="Show day-by-day history">
        {name} <History className="h-3.5 w-3.5 text-grey-400 group-hover:text-primary" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] w-[96vw] flex-col gap-3 sm:max-w-[1240px]">
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
              ["Actual", hm(totals.actual)],
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
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-grey-100">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="sticky top-0 bg-light-600 text-xs text-grey-500">
                <tr>{["Date", "Status", "In", "Out", "Actual", "Break", "Payable", "Late", "Early", "Overtime", "Rate", "Earned", "OT Pay", "Day Total"].map((h) => <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-grey-100">
                {days.map((d) => (
                  <tr key={d.date} className="hover:bg-light-600/50">
                    <td className="whitespace-nowrap px-2 py-1.5 font-number text-grey-900">{day(d.date)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", d.cls)}>{d.label}</span></td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{time(d.checkIn)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.checkIn && !d.checkOut ? <span className="text-error">—</span> : time(d.checkOut)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.actual ? hm(d.actual) : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number text-grey-500">{d.breakMin ? `${d.breakMin}m` : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.payable ? hm(d.payable) : "—"}</td>
                    <td className={cn("whitespace-nowrap px-2 py-1.5 font-number", d.late ? "text-orange" : "text-grey-300")}>{d.late ? `${d.late}m` : "—"}</td>
                    <td className={cn("whitespace-nowrap px-2 py-1.5 font-number", d.early ? "text-warning-900" : "text-grey-300")}>{d.early ? `${d.early}m` : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.overtime ? <span className={d.overtimeApproved ? "text-purple" : "text-grey-500"}>{hm(d.overtime)}{d.overtimeApproved ? " ✓" : ""}</span> : <span className="text-grey-300">—</span>}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number text-grey-500">{d.rate == null ? "—" : inr(d.rate)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.earned ? inr(d.earned) : <span className="text-grey-300">—</span>}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{d.overtimePay ? <span className="text-purple">{inr(d.overtimePay)}</span> : <span className="text-grey-300">—</span>}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number font-semibold text-grey-900">{d.earned || d.overtimePay ? inr((d.earned ?? 0) + (d.overtimePay ?? 0)) : <span className="font-normal text-grey-300">—</span>}</td>
                  </tr>
                ))}
                {days.length === 0 && <tr><td colSpan={14} className="px-3 py-8 text-center text-grey-500">Nothing in this period yet.</td></tr>}
              </tbody>
              <tfoot className="sticky bottom-0 bg-light-600 text-sm font-semibold text-grey-900">
                <tr>
                  <td className="px-2 py-2" colSpan={4}>Total · {days.length} days</td>
                  <td className="px-2 py-2 font-number">{hm(totals.actual)}</td>
                  <td className="px-2 py-2 font-number">{hm(days.reduce((n, d) => n + d.breakMin, 0))}</td>
                  <td className="px-2 py-2 font-number">{hm(totals.payable)}</td>
                  <td className="px-2 py-2 font-number">{totals.late}m</td>
                  <td className="px-2 py-2 font-number">{totals.early}m</td>
                  <td className="px-2 py-2 font-number">{hm(totals.overtime)}</td>
                  <td className="px-2 py-2" />
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
