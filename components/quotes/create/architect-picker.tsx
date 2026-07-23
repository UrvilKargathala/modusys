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
              <button
                type="button"
                aria-label="Clear architect"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="rounded p-0.5 text-grey-400 hover:text-error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
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

  const fields = [
    { label: "Company", value: architect.company },
    { label: "Address", value: architect.address },
    { label: "City", value: architect.city },
    { label: "State", value: architect.state },
    { label: "Postcode", value: architect.postcode },
    { label: "Mobile", value: architect.mobile },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-grey-100 bg-light-600 p-3 sm:grid-cols-3">
      {fields.map((f) => (
        <div key={f.label} className="flex flex-col gap-0.5">
          <span className="text-xs font-body text-grey-400">{f.label}</span>
          <span className="truncate text-sm font-body text-grey-700">{f.value || "—"}</span>
        </div>
      ))}
    </div>
  );
}
