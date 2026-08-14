"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEAVE_TYPES } from "@/lib/attendance-config";
import { toastStore } from "@/lib/store/toast-store";

function weekdaysBetweenClient(from: string, to: string): number {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function LeaveApplyForm({ onDone }: { onDone?: () => void } = {}) {
  const router = useRouter();
  const [leaveType, setLeaveType] = useState("CASUAL");
  const [customLeaveType, setCustomLeaveType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<"FIRST_HALF" | "SECOND_HALF">("FIRST_HALF");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalDays = useMemo(() => {
    if (isHalfDay) return fromDate ? 0.5 : 0;
    return weekdaysBetweenClient(fromDate, toDate || fromDate);
  }, [fromDate, toDate, isHalfDay]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveType,
          customLeaveType: leaveType === "OTHER" ? customLeaveType.trim() : undefined,
          fromDate,
          toDate: isHalfDay ? fromDate : toDate,
          isHalfDay,
          halfDayType: isHalfDay ? halfDayType : null,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to submit");
        toastStore.show(json.error || "Failed to submit leave request", "error");
        return;
      }
      toastStore.show("Leave request submitted for approval", "success");
      router.refresh();
      if (onDone) onDone();
      else router.push("/leaves");
    } finally {
      setBusy(false);
    }
  }

  const Wrapper = onDone ? "div" : Card;
  return (
    <Wrapper className={onDone ? "" : "p-6"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Leave Type</Label>
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            className="h-10 rounded-md border border-grey-200 px-3 text-sm font-body text-grey-900 focus:border-primary focus:outline-none"
          >
            {LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {leaveType === "OTHER" && (
          <div className="flex flex-col gap-1.5">
            <Label>Specify type</Label>
            <Input
              type="text"
              value={customLeaveType}
              onChange={(e) => setCustomLeaveType(e.target.value)}
              placeholder="e.g. Bereavement, Study leave"
              required
              maxLength={60}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>From Date</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>To Date</Label>
            <Input
              type="date"
              value={isHalfDay ? fromDate : toDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={isHalfDay}
              required={!isHalfDay}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-body text-grey-700">
          <input
            type="checkbox"
            checked={isHalfDay}
            onChange={(e) => setIsHalfDay(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Half day only
        </label>

        {isHalfDay && (
          <div className="flex gap-4 text-sm font-body text-grey-700">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="half"
                checked={halfDayType === "FIRST_HALF"}
                onChange={() => setHalfDayType("FIRST_HALF")}
                className="h-4 w-4 accent-primary"
              />
              First Half
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="half"
                checked={halfDayType === "SECOND_HALF"}
                onChange={() => setHalfDayType("SECOND_HALF")}
                className="h-4 w-4 accent-primary"
              />
              Second Half
            </label>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>Total Days</Label>
          <div className="rounded-md border border-grey-200 bg-grey-50 px-3 py-2 font-number text-sm text-grey-800">
            {totalDays}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Reason</Label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={4}
            className="w-full rounded-md border border-grey-200 px-3 py-2 text-sm font-body text-grey-900 focus:border-primary focus:outline-none"
            placeholder="Briefly explain the reason for leave"
          />
        </div>

        {error && <p className="text-sm font-body text-error">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          {onDone ? (
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
          ) : (
            <Link href="/leaves" className={buttonVariants({ variant: "outline" })}>
              Cancel
            </Link>
          )}
          <Button type="submit" disabled={busy || totalDays === 0 || (leaveType === "OTHER" && !customLeaveType.trim())}>
            {busy ? "Submitting…" : "Submit for Approval"}
          </Button>
        </div>
      </form>
    </Wrapper>
  );
}
