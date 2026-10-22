"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// "Where to Use": tick one or more places (Carcass, Shutter, Other Panel). The value is the list; an entry keeps it as "A,B".
export function PoWhereSelect({ value, options, onChange }: { value: string[]; options: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : options.filter((x) => x === o || value.includes(x)));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="Where to use" className="flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-left text-sm font-body text-grey-900 outline-none focus:border-primary">
        {value.length === 0 ? <span className="text-grey-400">Select where to use</span> : <span className="min-w-0 truncate">{value.join(", ")}</span>}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="flex flex-col">
          {options.map((o) => {
            const on = value.includes(o);
            return (
              <button key={o} type="button" onClick={() => toggle(o)} className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600 ${on ? "text-primary" : "text-grey-800"}`}>
                {o}
                {on && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
