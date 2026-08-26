"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ArchitectFormDialog } from "@/components/architects/architect-form-dialog";
import { useArchitects, architectsStore } from "@/lib/store/architects-store";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export function ArchitectPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const architects = useArchitects();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const selected = architects.find((a) => a.id === value);
  const fullName = (a: { firstName: string; lastName: string }) => `${a.firstName} ${a.lastName}`.trim();
  const results = architects.filter((a) => fullName(a).toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary">
          {selected ? (
            <span className="min-w-0 truncate">{fullName(selected)}</span>
          ) : (
            <span className="min-w-0 truncate text-grey-400">None (optional)</span>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {selected && (
              // role=button span (not a real <button>) because this sits inside
              // the PopoverTrigger button — nested <button> is invalid HTML.
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear architect"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange("");
                  }
                }}
                className="rounded p-0.5 text-grey-400 hover:text-error"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-grey-400" />
          </div>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <Input autoFocus placeholder="Search architects" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2" />
          <div className="flex max-h-52 flex-col overflow-y-auto">
            {results.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600",
                  a.id === value ? "text-primary" : "text-grey-800"
                )}
              >
                <span className="min-w-0 truncate">{fullName(a)}</span>
                {a.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
            {results.length === 0 && <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAddOpen(true);
            }}
            className="mt-1 flex items-center gap-1.5 rounded-md border-t border-grey-100 px-2 py-2 text-left text-sm font-body font-medium text-primary hover:bg-light-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Add new architect
          </button>
        </PopoverContent>
      </Popover>

      <ArchitectFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={async (values) => {
          const created = await architectsStore.createArchitect({ ...values, createdById: getCurrentUser().id });
          onChange(created.id);
        }}
      />
    </>
  );
}

export function ArchitectReadOnlyDetails({ architectId }: { architectId: string }) {
  const architects = useArchitects();
  const architect = architects.find((a) => a.id === architectId);
  if (!architect) return null;

  // `numeric: true` bits render in font-number (Outfit) per the app-wide
  // convention that any number-flavored value — here, the phone number —
  // uses the number font, not body text.
  const cityLine = [architect.address, architect.city, architect.state, architect.postcode].filter(Boolean).join(", ");
  const bits = [
    architect.company && { text: architect.company, numeric: false },
    cityLine && { text: cityLine, numeric: false },
    architect.mobile && { text: architect.mobile, numeric: true },
  ].filter((b): b is { text: string; numeric: boolean } => !!b);
  if (bits.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-grey-100 bg-light-600 px-3 py-1.5 text-xs font-body text-grey-600">
      {bits.map((b, i) => (
        <span key={i} className="flex min-w-0 max-w-full items-center gap-2">
          {i > 0 && <span className="text-grey-300">·</span>}
          <span className={cn("truncate", b.numeric && "font-number")}>{b.text}</span>
        </span>
      ))}
    </div>
  );
}
