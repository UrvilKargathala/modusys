"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type StatusMenuOption = { value: string; label: string; className: string };

// The Quotes status picker's look (pill button, coloured list in a popover) for small in-table status cells.
export function StatusMenu({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: StatusMenuOption[];
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className={cn("flex h-7 w-auto items-center justify-between gap-2 rounded-lg border border-grey-100 px-2 text-xs font-body font-medium outline-none focus:border-primary", current.className)}
      >
        {current.label}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1.5">
        <div className="flex flex-col gap-1">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setOpen(false);
                if (o.value !== value) onChange(o.value);
              }}
              className={cn("flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-body font-medium transition-colors hover:brightness-95", o.className)}
            >
              {o.label}
              {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
