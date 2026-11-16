"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EditTimesDialog } from "@/components/payroll/attendance-time-dialogs";
import { cn } from "@/lib/utils";

export type DayCellData = {
  date: string;
  title: string; // "Thu 01/10/2026"
  isToday: boolean;
  muted: boolean; // weekly off / holiday without work
  label: string | null; // status, null for days still to come
  cls: string;
  holiday: string | null;
  shiftTime: string | null; // fixed timing for a working day, e.g. "9:30–6:00"
  shiftHours: string | null; // fixed hours, e.g. "8h 00m"
  diff: number | null; // worked − fixed minutes, once checked out on a working day
  workedMinutes: number | null;
  shiftMinutes: number | null;
  checkIn: string | null; // "9:28 am"
  checkOut: string | null;
  checkInPlace: string | null;
  checkOutPlace: string | null;
  worked: string | null; // "8h 07m"
  payable: string | null;
  late: number;
  early: number;
  overtime: string | null;
  overtimeApproved: boolean;
  missingOut: boolean;
  reportHref: string;
  dayHref: string;
  edit: { employeeId: string; name: string; checkIn: string; checkOut: string; label: string } | null;
};

// One month-calendar day, kept small (130 × 110): status, times and hours at a glance; click for the full day in a popup.
// Hours as a clock for the small box: 08:00, 08:07, 00:07 (the popup keeps the long form).
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function CalendarDayCell({ d }: { d: DayCellData }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  // Worked 5+ minutes over the fixed hours (olive), 10+ under (orange) or 30+ under (red): the day box takes that colour.
  const over = d.diff != null && d.diff >= 5;
  const veryShort = d.diff != null && d.diff <= -30;
  const short = d.diff != null && d.diff <= -10;
  const sunday = new Date(`${d.date}T00:00:00Z`).getUTCDay() === 0;
  const dot = (on: boolean, color: string, title: string) => on && <span title={title} className={cn("h-1.5 w-1.5 rounded-full", color)} />;
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className={cn("flex h-[110px] w-full min-w-0 flex-col gap-1 rounded-xl border border-white/70 bg-white/45 p-1.5 text-left shadow-[0_2px_10px_rgb(40_138_184/0.08)] outline-none backdrop-blur-md transition-colors hover:bg-white/65 focus-visible:ring-2 focus-visible:ring-primary/30", d.muted && "bg-white/25", sunday && "border-grey-100 bg-grey-100/70 hover:bg-grey-100", over && "border-day-over/50 bg-day-over/50 hover:bg-day-over/60", short && !veryShort && "border-day-short/50 bg-day-short/50 hover:bg-day-short/60", veryShort && "border-day-very-short/50 bg-day-very-short/50 hover:bg-day-very-short/60", d.isToday && "border-primary/50", open && "ring-2 ring-primary/30", open && !over && !short && "bg-white/80")}>
          <span className="flex w-full items-start justify-between gap-1">
            {d.label ? <span className={cn("truncate rounded px-1.5 py-0.5 text-[10px] font-semibold", d.cls)}>{d.label}</span> : <span />}
            <span className={cn("flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 font-number text-[10px] font-semibold", d.isToday ? "bg-primary text-white" : "text-grey-900")}>{Number(d.date.slice(8))}</span>
          </span>
          {d.holiday && <span className="truncate text-[10px] text-teal">{d.holiday}</span>}
          {/* Fixed timing on its own tint, so it never reads as the actual times below it. */}
          {d.shiftTime && <span className={cn("truncate font-number text-[10px] font-medium", over || short ? "text-grey-800" : "text-shift")} title="Fixed timing">{d.shiftTime}</span>}
          {d.checkIn && (
            <span className="flex items-center gap-1 font-number text-[10px] text-grey-900">
              <span className="truncate">{d.checkIn} – {d.checkOut ?? "…"}</span>
              {dot(d.late > 0, "bg-warning", `Late ${d.late}m`)}
              {dot(d.early > 0, "bg-orange", `Early ${d.early}m`)}
              {dot(!!d.overtime, d.overtimeApproved ? "bg-purple" : "bg-grey-300", `Overtime ${d.overtime}`)}
            </span>
          )}
          {(d.checkIn || d.shiftHours) && (
            // Fixed – worked = difference, e.g. 08:00 – 08:07 = +00:07 (green over, red under).
            <span className={cn("mt-auto flex items-center gap-0.5 overflow-hidden whitespace-nowrap font-number text-[10px]", over || short ? "text-grey-700" : "text-grey-400")}>
              {d.shiftMinutes != null && <><span className={cn("shrink-0 font-medium", over || short ? "text-grey-800" : "text-shift")} title={`Fixed hours ${d.shiftHours}`}>{hhmm(d.shiftMinutes)}</span><span>–</span></>}
              <span className="shrink-0 font-medium text-grey-900" title={d.worked ? `Worked ${d.worked}` : undefined}>
                {d.checkIn ? (d.workedMinutes != null ? hhmm(d.workedMinutes) : d.missingOut ? <span className="text-error">No out</span> : "At work") : "—"}
              </span>
              {d.diff != null && d.diff !== 0 && (
                <>
                  <span>=</span>
                  <span className={cn("shrink-0 font-semibold", over || short ? "text-grey-900" : d.diff > 0 ? "text-success" : "text-error")} title={d.diff > 0 ? "More than the fixed hours" : "Less than the fixed hours"}>
                    {d.diff > 0 ? "+" : "−"}{hhmm(Math.abs(d.diff))}
                  </span>
                </>
              )}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-64 gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-heading text-sm font-semibold text-grey-900">{d.title}</span>
            {d.label && <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", d.cls)}>{d.label}</span>}
          </div>
          {d.holiday && <p className="text-xs text-teal">{d.holiday}</p>}
          {d.checkIn ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-grey-500">Check-in</dt>
              <dd className="min-w-0">
                <span className="font-number font-medium text-grey-900">{d.checkIn}</span>
                {d.checkInPlace && <span className="flex items-start gap-1 text-grey-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="truncate" title={d.checkInPlace}>{d.checkInPlace}</span></span>}
              </dd>
              <dt className="text-grey-500">Check-out</dt>
              <dd className="min-w-0">
                <span className={cn("font-number font-medium", d.checkOut ? "text-grey-900" : "text-error")}>{d.checkOut ?? (d.missingOut ? "Not checked out" : "Still at work")}</span>
                {d.checkOutPlace && <span className="flex items-start gap-1 text-grey-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="truncate" title={d.checkOutPlace}>{d.checkOutPlace}</span></span>}
              </dd>
              <dt className="text-grey-500">Worked</dt>
              <dd className="font-number text-grey-900">{d.worked ?? "—"}{d.payable && <span className="text-grey-500"> · {d.payable} paid</span>}</dd>
              {d.late > 0 && <><dt className="text-grey-500">Late</dt><dd className="font-number text-warning-900">{d.late} min</dd></>}
              {d.early > 0 && <><dt className="text-grey-500">Early exit</dt><dd className="font-number text-orange">{d.early} min</dd></>}
              {d.overtime && <><dt className="text-grey-500">Overtime</dt><dd className="font-number text-purple">{d.overtime} {d.overtimeApproved ? "· approved" : "· not approved"}</dd></>}
            </dl>
          ) : (
            <p className="text-xs text-grey-500">{d.label ? "No check-in this day." : "Nothing yet."}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-grey-100 pt-2 text-xs">
            {d.edit && (
              <button type="button" onClick={() => { setOpen(false); setEditing(true); }} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-medium text-white hover:bg-primary/90">
                <Pencil className="h-3 w-3" /> {d.edit.label}
              </button>
            )}
            <Link href={d.dayHref} className="text-secondary hover:underline">Day view</Link>
            <Link href={d.reportHref} className="text-secondary hover:underline">Full report</Link>
          </div>
        </PopoverContent>
      </Popover>
      {d.edit && <EditTimesDialog employeeId={d.edit.employeeId} name={d.edit.name} date={d.date} checkIn={d.edit.checkIn} checkOut={d.edit.checkOut} open={editing} onOpenChange={setEditing} />}
    </>
  );
}
