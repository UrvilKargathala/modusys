"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Same searchable-popover-with-inline-add UX as MaterialReferenceSelect, for
// a plain string vocabulary that isn't (yet) a real Material Library
// category — e.g. Panel Calculator's "Product" list. No separate Add
// dialog needed since there's nothing to fill in beyond the name itself.
export function TextReferenceSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open && !disabled} onOpenChange={(next) => setOpen(disabled ? false : next)}>
      <PopoverTrigger
        disabled={disabled}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-light-600 disabled:text-grey-300"
      >
        {value ? (
          <span className="min-w-0 truncate">{value}</span>
        ) : (
          <span className="min-w-0 truncate text-grey-400">{placeholder ?? `Select ${label.toLowerCase()}`}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input
          autoFocus
          placeholder={`Search ${label.toLowerCase()}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2"
        />
        <div className="flex max-h-52 flex-col overflow-y-auto">
          {results.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => select(o)}
              className={cn(
                "flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600",
                o === value ? "text-primary" : "text-grey-800"
              )}
            >
              <span className="min-w-0 truncate">{o}</span>
              {o === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
          {results.length === 0 && (
            <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>
          )}
        </div>
        {query.trim() && !exactMatch && (
          <button
            type="button"
            onClick={() => select(query.trim())}
            className="mt-1 flex items-center gap-1.5 rounded-md border-t border-grey-100 px-2 py-2 text-left text-sm font-body font-medium text-primary hover:bg-light-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Add &quot;{query.trim()}&quot;
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
