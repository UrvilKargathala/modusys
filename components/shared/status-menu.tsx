"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type StatusMenuOption = { value: string; label: string; className: string; style?: React.CSSProperties };

// The Quotes status picker's look (pill button, coloured list in a popover) for small in-table status cells.
export function StatusMenu({
  value,
  options,
  onChange,
  label,
  onAdd,
}: {
  value: string;
  options: StatusMenuOption[];
  onChange: (value: string) => void;
  label: string;
  // When given, the list ends with "Add status": type a name and it is set (and from then on offered in the list).
  onAdd?: (name: string) => void;
}) {
  const [adding, setAdding] = useState("");
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className={cn("flex h-7 w-auto items-center justify-between gap-2 rounded-lg border border-grey-100 px-2 text-xs font-body font-medium outline-none focus:border-primary", current.className)}
        style={current.style}
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
              style={o.style}
            >
              {o.label}
              {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
          {onAdd && (
            <form
              className="mt-1 flex items-center gap-1 border-t border-grey-100 pt-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const name = adding.trim();
                if (!name) return;
                setAdding("");
                setOpen(false);
                onAdd(name);
              }}
            >
              <input
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                placeholder="Add status"
                maxLength={40}
                aria-label="New status name"
                className="h-7 min-w-0 flex-1 rounded-md border border-grey-100 bg-card px-2 text-xs font-body text-grey-900 outline-none focus:border-primary"
              />
              <button type="submit" className="h-7 rounded-md bg-primary px-2 text-xs font-body font-medium text-white">Add</button>
            </form>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
