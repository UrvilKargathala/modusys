"use client";

import { useState } from "react";
import { Check, ChevronDown, Pencil, Trash2 } from "lucide-react";
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
  editable,
  onRename,
  onDelete,
}: {
  value: string;
  options: StatusMenuOption[];
  onChange: (value: string) => void;
  label: string;
  // When given, the list ends with "Add status": type a name and it is set (and from then on offered in the list).
  onAdd?: (name: string) => void;
  // Options for which editable() is true get pencil (rename in place: Enter saves, Esc cancels) and bin buttons.
  editable?: (value: string) => boolean;
  onRename?: (value: string, name: string) => void;
  onDelete?: (value: string) => void;
}) {
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const saveEdit = () => {
    const name = draft.trim();
    if (editing && name) onRename?.(editing, name);
    setEditing(null);
  };
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
      <PopoverContent align="start" className="w-56 p-1.5">
        <div className="flex flex-col gap-1">
          {options.map((o) =>
            editing === o.value ? (
              <input
                key={o.value}
                autoFocus
                value={draft}
                maxLength={40}
                aria-label={`New name for ${o.label}`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setEditing(null);
                  }
                }}
                onFocus={(e) => e.target.select()}
                onBlur={saveEdit}
                className="h-8 rounded-md border border-primary bg-card px-2.5 text-sm font-body text-grey-900 outline-none"
              />
            ) : (
              <div key={o.value} className={cn("group flex items-center rounded-md transition-colors hover:brightness-95", o.className)} style={o.style}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (o.value !== value) onChange(o.value);
                  }}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm font-body font-medium"
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
                {editable?.(o.value) && (
                  <span className="flex shrink-0 items-center pr-1 opacity-60 group-hover:opacity-100">
                    <button type="button" aria-label={`Rename ${o.label}`} title="Rename" onClick={() => { setEditing(o.value); setDraft(o.label); }} className="rounded p-1 hover:bg-white/60">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button type="button" aria-label={`Delete ${o.label}`} title="Delete" onClick={() => onDelete?.(o.value)} className="rounded p-1 hover:bg-white/60 hover:text-error">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )
          )}
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
