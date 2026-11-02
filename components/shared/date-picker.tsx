"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

type Mode = "day" | "month" | "year";
type View = "days" | "months" | "years";

// Value text for a form: day "2026-11-02", month "2026-11", year "2026" (the same text the browser's own date, month and number boxes send).
function parse(value: string) {
  const [y, m = "1", d = "1"] = value.split("-");
  const out = { y: Number(y), m: Number(m) - 1, d: Number(d) };
  return Number.isFinite(out.y) && out.y > 0 ? out : null;
}

// The typed box holds digits only; they are shown as "dd / mm / yyyy", "mm / yyyy" or "yyyy".
const LEN = { day: 8, month: 6, year: 4 };
const toDigits = (value: string, mode: Mode) => {
  const p = parse(value);
  if (!p) return "";
  return mode === "day" ? `${pad(p.d)}${pad(p.m + 1)}${p.y}` : mode === "month" ? `${pad(p.m + 1)}${p.y}` : String(p.y);
};
const toText = (digits: string, mode: Mode) =>
  (mode === "day" ? [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)] : mode === "month" ? [digits.slice(0, 2), digits.slice(2)] : [digits]).filter(Boolean).join(" / ");
// A full set of digits as the form's value text, or "" when it is not a real date (31 / 02, month 13, year before 1900).
const toValue = (digits: string, mode: Mode) => {
  if (digits.length !== LEN[mode]) return "";
  const y = Number(digits.slice(-4));
  const m = mode === "year" ? 1 : Number(digits.slice(mode === "day" ? 2 : 0, mode === "day" ? 4 : 2));
  const d = mode === "day" ? Number(digits.slice(0, 2)) : 1;
  const real = new Date(y, m - 1, d);
  if (y < 1900 || real.getMonth() !== m - 1 || real.getDate() !== d) return "";
  return mode === "day" ? `${y}-${pad(m)}-${pad(d)}` : mode === "month" ? `${y}-${pad(m)}` : String(y);
};
const PLACEHOLDER = { day: "dd / mm / yyyy", month: "mm / yyyy", year: "yyyy" };

// A date box you can type in (digits only, the slashes are added) with a calendar behind its icon: pick a day, a month or a year. Sends its value under
// `name` when the form is submitted. A half-typed or impossible date is put back to the last good one when you leave the box.
export function DatePicker({ name, defaultValue, mode, id, className }: { name: string; defaultValue: string; mode: Mode; id?: string; className?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [digits, setDigits] = useState(toDigits(defaultValue, mode));
  const [open, setOpen] = useState(false);
  const now = new Date();
  const sel = parse(value);
  const first: View = mode === "day" ? "days" : mode === "month" ? "months" : "years";
  const [view, setView] = useState<View>(first);
  const [cursor, setCursor] = useState({ y: sel?.y ?? now.getFullYear(), m: sel?.m ?? now.getMonth() });

  const commit = (y: number, m: number, d: number) => {
    const v = mode === "day" ? `${y}-${pad(m + 1)}-${pad(d)}` : mode === "month" ? `${y}-${pad(m + 1)}` : String(y);
    setValue(v);
    setDigits(toDigits(v, mode));
    setOpen(false);
  };
  const type = (text: string) => {
    let next = text.replace(/\D/g, "").slice(0, LEN[mode]);
    // Backspace over a " / " removes no digit: take the last digit off instead of leaving the box stuck.
    if (next === digits && text.length < toText(digits, mode).length) next = digits.slice(0, -1);
    setDigits(next);
    const v = toValue(next, mode);
    if (v) setValue(v);
  };
  const bad = digits.length === LEN[mode] && !toValue(digits, mode);
  const onOpen = (o: boolean) => {
    setOpen(o);
    if (o) {
      setView(first);
      setCursor({ y: sel?.y ?? now.getFullYear(), m: sel?.m ?? now.getMonth() });
    }
  };
  const step = (n: number) => {
    if (view === "days") {
      const t = cursor.y * 12 + cursor.m + n;
      setCursor({ y: Math.floor(t / 12), m: t % 12 < 0 ? t % 12 + 12 : t % 12 });
    } else setCursor((c) => ({ ...c, y: c.y + (view === "years" ? 12 * n : n) }));
  };

  const yearStart = cursor.y - (cursor.y % 12);
  const lead = new Date(cursor.y, cursor.m, 1).getDay();
  const weeks = lead + new Date(cursor.y, cursor.m + 1, 0).getDate() > 35 ? 6 : 5;
  const cells = Array.from({ length: weeks * 7 }, (_, i) => new Date(cursor.y, cursor.m, 1 - lead + i));
  const title = view === "days" ? `${MONTHS[cursor.m]} ${cursor.y}` : view === "months" ? String(cursor.y) : `${yearStart} – ${yearStart + 11}`;
  const cellBase = "flex items-center justify-center rounded-md text-sm font-body hover:bg-light-600 focus-visible:outline-2 focus-visible:outline-primary";
  const on = "bg-primary text-white hover:bg-primary";

  return (
    <>
      <input type="hidden" name={name} value={value} readOnly />
      <Popover open={open} onOpenChange={onOpen}>
        <div
          className={cn(
            "relative flex h-9 min-w-48 items-center rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.14)] ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-primary",
            bad && "ring-2 ring-error",
            className
          )}
        >
          <input
            id={id}
            inputMode="numeric"
            autoComplete="off"
            placeholder={PLACEHOLDER[mode]}
            value={toText(digits, mode)}
            aria-invalid={bad || undefined}
            onChange={(e) => type(e.target.value)}
            onBlur={() => !toValue(digits, mode) && setDigits(toDigits(value, mode))}
            className="h-full min-w-0 flex-1 rounded-xl bg-transparent pl-3 pr-1 text-sm text-grey-900 outline-none placeholder:text-grey-400"
          />
          <PopoverTrigger aria-label="Open calendar" className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-grey-500 hover:bg-light-600 hover:text-grey-700">
            <CalendarDays className="h-4 w-4" />
          </PopoverTrigger>
        </div>
        <PopoverContent align="end" className="w-72 bg-card p-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={view === "years"}
              onClick={() => setView(view === "days" ? "months" : "years")}
              className="rounded-md px-1.5 py-1 text-sm font-semibold text-grey-900 hover:bg-light-600 disabled:cursor-default disabled:hover:bg-transparent"
            >
              {title}
            </button>
            <div className="flex gap-1">
              <button type="button" aria-label="Previous" onClick={() => step(-1)} className="rounded-md p-1.5 text-primary hover:bg-light-600"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Next" onClick={() => step(1)} className="rounded-md p-1.5 text-primary hover:bg-light-600"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          {view === "days" && (
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {DAYS.map((d) => <span key={d} className="py-1 text-xs text-grey-500">{d}</span>)}
              {cells.map((c) => {
                const isSel = sel && mode === "day" && c.getFullYear() === sel.y && c.getMonth() === sel.m && c.getDate() === sel.d;
                const isToday = c.toDateString() === now.toDateString();
                return (
                  <button
                    key={c.getTime()}
                    type="button"
                    onClick={() => commit(c.getFullYear(), c.getMonth(), c.getDate())}
                    className={cn(cellBase, "h-9 w-9 justify-self-center", c.getMonth() !== cursor.m && "text-grey-300", isToday && !isSel && "bg-primary-transparent text-primary", isSel && on)}
                  >
                    {c.getDate()}
                  </button>
                );
              })}
            </div>
          )}
          {view === "months" && (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((m, i) => {
                const isSel = sel && sel.y === cursor.y && sel.m === i;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => (mode === "month" ? commit(cursor.y, i, 1) : (setCursor({ y: cursor.y, m: i }), setView("days")))}
                    className={cn(cellBase, "h-10", isSel && on)}
                  >
                    {m.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}
          {view === "years" && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => (mode === "year" ? commit(y, 0, 1) : (setCursor((c) => ({ ...c, y })), setView("months")))}
                  className={cn(cellBase, "h-10", sel?.y === y && on)}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => commit(now.getFullYear(), now.getMonth(), now.getDate())}
            className="self-start rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:bg-light-600"
          >
            {mode === "day" ? "Today" : mode === "month" ? "This month" : "This year"}
          </button>
        </PopoverContent>
      </Popover>
    </>
  );
}
