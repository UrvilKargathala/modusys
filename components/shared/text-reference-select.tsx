"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
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
  allowAdd = true,
  triggerClassName,
  onAddNew,
  onRename,
  onDelete,
  onCopy,
  wide = false,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowAdd?: boolean;
  triggerClassName?: string;
  // When set, an always-visible "+ Add new …" button at the bottom calls this instead of the inline add.
  onAddNew?: () => void;
  // When set, each saved option gets a pencil (rename) / bin (delete) icon.
  onRename?: (from: string, to: string) => void;
  onDelete?: (name: string) => void;
  // When set, each saved option gets a copy icon; return the copy's name to open it for renaming straight away.
  onCopy?: (name: string) => string | void;
  // Long values: a wider list that shows each option in full, wrapping onto more lines.
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // "+ Add new …" with nothing typed: the search box asks for the new name; typing it turns the button into Add "name".
  const [adding, setAdding] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // The picked value is listed too, so a name just added shows (ticked) before anything with it is saved.
  const listed = value && !options.includes(value) ? [value, ...options] : options;
  const results = listed.filter((o) => o.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = listed.some((o) => o.toLowerCase() === query.trim().toLowerCase());
  const newName = query.trim() && !exactMatch ? query.trim() : "";

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
    setAdding(false);
  };

  // Pencil on an option: rename it in place (Enter saves, Esc cancels). A name another option already has is refused.
  const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);
  const renameClash = !!editing && listed.some((o) => o !== editing.from && o.toLowerCase() === editing.to.trim().toLowerCase());
  const saveRename = () => {
    if (!editing || renameClash) return;
    const to = editing.to.trim();
    if (to && to !== editing.from) onRename?.(editing.from, to);
    setEditing(null);
  };

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(next) => {
        setOpen(disabled ? false : next);
        if (!next) {
          setAdding(false);
          setEditing(null);
        }
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-light-600 disabled:text-grey-300",
          triggerClassName
        )}
      >
        {value ? (
          <span className="min-w-0 truncate">{value}</span>
        ) : (
          <span className="min-w-0 truncate text-grey-400">{placeholder ?? `Select ${label.toLowerCase()}`}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("p-2", wide ? "w-[min(36rem,calc(100vw-2rem))]" : "w-72")}>
        <Input
          ref={searchRef}
          autoFocus
          placeholder={adding ? `Type the new ${label.toLowerCase()} name` : `Search ${label.toLowerCase()}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && adding && newName) {
              e.preventDefault();
              select(newName);
            }
          }}
          className="mb-2"
        />
        <div className={cn("flex flex-col overflow-y-auto", wide ? "max-h-80" : "max-h-52")}>
          {results.map((o) =>
            editing?.from === o ? (
              <div key={o} className="flex items-center gap-1 px-1 py-0.5">
                <Input
                  autoFocus
                  aria-label={`New name for ${o}`}
                  value={editing.to}
                  aria-invalid={renameClash}
                  onChange={(e) => setEditing({ from: o, to: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveRename();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditing(null);
                    }
                  }}
                  className="h-7 flex-1 text-sm"
                />
                <button type="button" onClick={saveRename} aria-label="Save name" className="rounded p-1 text-primary hover:bg-light-600">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setEditing(null)} aria-label="Cancel rename" className="rounded p-1 text-grey-400 hover:bg-light-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div key={o} className={cn("flex items-center rounded-md hover:bg-light-600", o === value ? "text-primary" : "text-grey-800")}>
                <button
                  type="button"
                  onClick={() => select(o)}
                  className={cn("flex min-w-0 flex-1 justify-between gap-2 px-2 py-1.5 text-left text-sm font-body", wide ? "items-start" : "items-center")}
                >
                  <span className={cn("min-w-0", wide ? "break-words" : "truncate")}>{o}</span>
                  {o === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
                {onCopy && options.includes(o) && (
                  <button
                    type="button"
                    onClick={() => {
                      const copy = onCopy(o);
                      if (copy) setEditing({ from: copy, to: copy });
                    }}
                    aria-label={`Copy ${o}`}
                    className="rounded p-1 text-grey-300 hover:text-primary"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
                {onRename && options.includes(o) && (
                  <button type="button" onClick={() => setEditing({ from: o, to: o })} aria-label={`Rename ${o}`} className="rounded p-1 text-grey-300 hover:text-primary">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDelete && options.includes(o) && (
                  <button type="button" onClick={() => onDelete(o)} aria-label={`Delete ${o}`} className="mr-1 rounded p-1 text-grey-300 hover:text-error">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          )}
          {results.length === 0 && (
            <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>
          )}
        </div>
        {onAddNew && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQuery("");
              onAddNew();
            }}
            className="mt-1 flex w-full items-center gap-1.5 rounded-md border-t border-grey-100 px-2 py-2 text-left text-sm font-body font-medium text-primary hover:bg-light-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Add new {label.toLowerCase()}
          </button>
        )}
        {!onAddNew && allowAdd && (
          <button
            type="button"
            onClick={() => {
              if (newName) return select(newName);
              setAdding(true);
              searchRef.current?.focus();
            }}
            className="mt-1 flex w-full items-center gap-1.5 rounded-md border-t border-grey-100 px-2 py-2 text-left text-sm font-body font-medium text-primary hover:bg-light-600"
          >
            <Plus className="h-3.5 w-3.5" />
            {newName ? <>Add &quot;{newName}&quot;</> : `Add new ${label.toLowerCase()}`}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
