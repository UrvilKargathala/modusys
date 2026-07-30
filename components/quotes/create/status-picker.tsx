"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { statusConfig, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";

const statusOptions: StatusKey[] = ["draft", "approved", "in-production", "completed", "cancelled"];

// Native <select><option> can't reliably show a background color across
// browsers, so unlike other pickers in this app the trigger AND the options
// need real DOM elements — same Popover + button-list pattern as
// CustomerPicker/MaterialReferenceSelect, just with each row showing its
// statusConfig badge colors instead of plain text.
export function StatusPicker({ value, onChange }: { value: StatusKey; onChange: (status: StatusKey) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = statusConfig[value];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-grey-100 px-3 text-sm font-body font-medium outline-none focus:border-primary",
          cfg.bg,
          cfg.color
        )}
      >
        {cfg.label}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1.5">
        <div className="flex flex-col gap-1">
          {statusOptions.map((s) => {
            const optionCfg = statusConfig[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-body font-medium transition-colors",
                  optionCfg.bg,
                  optionCfg.color,
                  "hover:brightness-95"
                )}
              >
                {optionCfg.label}
                {s === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
