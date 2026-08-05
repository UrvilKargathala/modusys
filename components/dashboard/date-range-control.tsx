"use client";

import type { DateRange } from "@/lib/types";

export function DateRangeControl({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-[#D9C8C9] bg-[#D9C8C9] px-3 py-1.5 text-sm font-body sm:w-auto">
      <input
        type="date"
        value={value.from}
        max={value.to}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="min-w-0 flex-1 bg-transparent font-number text-grey-700 outline-none sm:flex-none"
        aria-label="From date"
      />
      <span className="text-grey-300">→</span>
      <input
        type="date"
        value={value.to}
        min={value.from}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="min-w-0 flex-1 bg-transparent font-number text-grey-700 outline-none sm:flex-none"
        aria-label="To date"
      />
    </div>
  );
}
