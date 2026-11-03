"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastStore } from "@/lib/store/toast-store";
import { formatInr } from "@/lib/format";
import { holidayRanges } from "@/lib/payroll";

async function send(url: string, init: RequestInit, ok: string) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    toastStore.show(body.error ?? "Something went wrong", "error");
    return false;
  }
  toastStore.show(ok, "success");
  return true;
}

// Finalize (freeze) or reopen one employee's month.
export function FinalizeButton({ employeeId, period, finalized, disabled }: { employeeId: string; period: string; finalized: boolean; disabled?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (finalized && !window.confirm("Reopen this month? Its totals will be calculated live again from current attendance and rate.")) return;
    setBusy(true);
    const ok = finalized
      ? await send(`/api/attendance/payroll/finalize?employeeId=${encodeURIComponent(employeeId)}&period=${period}`, { method: "DELETE" }, "Month reopened")
      : await send("/api/attendance/payroll/finalize", { method: "POST", body: JSON.stringify({ employeeId, period }) }, "Month finalized");
    setBusy(false);
    if (ok) router.refresh();
  };
  return (
    <Button type="button" size="sm" variant="outline" disabled={busy || (!finalized && !!disabled)} title={!finalized ? disabled : undefined} onClick={() => void run()}>
      {finalized ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} {finalized ? "Reopen" : "Finalize"}
    </Button>
  );
}

// Approve or withdraw one day's overtime.
export function OvertimeToggle({ recordId, approved, locked }: { recordId: string; approved: boolean; locked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <label className={`inline-flex items-center gap-1.5 text-xs ${locked ? "text-grey-400" : "text-grey-700"}`} title={locked ? "Month finalized" : "Approved by default — untick to stop paying this overtime"}>
      <input type="checkbox" checked={approved} disabled={busy || locked} className="h-3.5 w-3.5 accent-primary"
        onChange={async (e) => {
          setBusy(true);
          const ok = await send("/api/attendance/overtime", { method: "PATCH", body: JSON.stringify({ recordId, approved: e.target.checked }) }, e.target.checked ? "Overtime approved" : "Overtime withdrawn");
          setBusy(false);
          if (ok) router.refresh();
        }} />
      Approved
    </label>
  );
}

export type AdjustmentRow = { id: string; kind: string; amount: number; reason: string; createdBy: string | null };

// The month's additions and deductions for one employee, with a small add form. Locked while the month is finalized.
export function AdjustmentsPanel({ employeeId, period, rows, locked }: { employeeId: string; period: string; rows: AdjustmentRow[]; locked: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<"ADDITION" | "DEDUCTION">("DEDUCTION");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    const ok = await send("/api/attendance/payroll/adjustments", { method: "POST", body: JSON.stringify({ employeeId, period, kind, amount, reason }) }, "Adjustment added");
    setBusy(false);
    if (ok) {
      setAmount("");
      setReason("");
      router.refresh();
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="text-sm text-grey-500">No additions or deductions for this month.</p>
      ) : (
        <ul className="divide-y divide-grey-100 rounded-lg border border-grey-100">
          {rows.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-grey-700">{a.reason}{a.createdBy ? <span className="text-grey-400"> · {a.createdBy}</span> : null}</span>
              <span className="flex items-center gap-2">
                <span className={`font-number ${a.kind === "ADDITION" ? "text-success" : "text-error"}`}>{a.kind === "ADDITION" ? "+" : "−"}{formatInr(a.amount)}</span>
                {!locked && (
                  <button type="button" aria-label="Remove adjustment" className="rounded p-1 text-grey-400 hover:text-error"
                    onClick={async () => { if (await send(`/api/attendance/payroll/adjustments?id=${a.id}`, { method: "DELETE" }, "Adjustment removed")) router.refresh(); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!locked && (
        <div className="flex flex-wrap items-end gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as "ADDITION" | "DEDUCTION")} aria-label="Type" className="h-9 rounded-md border border-grey-200 bg-card px-2 text-sm">
            <option value="DEDUCTION">Deduction</option>
            <option value="ADDITION">Addition</option>
          </select>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ₹" className="h-9 w-32" aria-label="Amount" />
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="h-9 min-w-48 flex-1" aria-label="Reason" />
          <Button type="button" size="sm" disabled={busy || !amount || !reason.trim()} onClick={() => void add()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}

// Company holidays: list with remove, and an add form (Start Date, End Date and Description, all required).
export function HolidaysPanel({ rows }: { rows: { id: string; date: string; name: string }[] }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const dmy = (d: string) => d.split("-").reverse().join("/");
  const ranges = holidayRanges(rows);
  return (
    <div className="flex flex-col gap-3">
      {ranges.length === 0 ? (
        <p className="text-sm text-grey-500">No holidays added yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {ranges.map((h) => (
            <li key={h.ids[0]} className="flex items-center gap-2 rounded-full border border-grey-200 bg-card py-1 pl-3 pr-1 text-xs">
              <span className="font-number text-grey-900">{h.start === h.end ? dmy(h.start) : `${dmy(h.start)} – ${dmy(h.end)}`}</span>
              <span className="text-grey-600">{h.name}</span>
              {h.ids.length > 1 && <span className="font-number text-grey-400">{h.ids.length} days</span>}
              <button type="button" aria-label={`Remove ${h.name}`} className="rounded-full p-1 text-grey-400 hover:text-error"
                onClick={async () => { if (await send(`/api/attendance/holidays?id=${h.ids.join(",")}`, { method: "DELETE" }, "Holiday removed")) router.refresh(); }}>
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-grey-600">
          <span>Start Date <span className="text-error">*</span></span>
          {/* A one-day holiday needs only the start date: the end date follows it until changed. */}
          <Input type="date" required value={startDate} onChange={(e) => { const v = e.target.value; setStartDate(v); if (!endDate || endDate < v) setEndDate(v); }} className="h-9 w-44" aria-label="Holiday start date" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-grey-600">
          <span>End Date <span className="text-error">*</span></span>
          <Input type="date" required min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-44" aria-label="Holiday end date" />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-grey-600">
          <span>Description <span className="text-error">*</span></span>
          <Input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Diwali vacation" maxLength={200} className="h-9" aria-label="Holiday description" />
        </label>
        <Button type="button" size="sm" disabled={!startDate || !endDate || endDate < startDate || !description.trim()}
          onClick={async () => {
            if (await send("/api/attendance/holidays", { method: "POST", body: JSON.stringify({ startDate, endDate, description }) }, "Holiday added")) {
              setStartDate(""); setEndDate(""); setDescription(""); router.refresh();
            }
          }}>
          <Plus className="h-3.5 w-3.5" /> Add holiday
        </Button>
      </div>
    </div>
  );
}
