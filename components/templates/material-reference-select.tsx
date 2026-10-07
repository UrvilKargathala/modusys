"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { MaterialItemFormDialog } from "@/components/templates/material-item-form-dialog";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";
import { getMaterialCategory, type MaterialCategoryKey } from "@/lib/mock/material-spec";
import { cn } from "@/lib/utils";

// Searchable single-select sourced live from Material Library, with an
// inline "+ Add new" escape hatch (opens the same Add modal Material Spec
// itself uses) so building a Furniture Price List row is never blocked on
// someone having already set up Material Library first.
export function MaterialReferenceSelect({
  category,
  value,
  onChange,
  nameOnly = false,
  bold = false,
  triggerClassName,
  disabled = false,
  wide = false,
  sorted = false,
  fallbackText,
}: {
  category: MaterialCategoryKey;
  value: string;
  onChange: (id: string) => void;
  nameOnly?: boolean;
  bold?: boolean;
  triggerClassName?: string;
  disabled?: boolean;
  // Wide: roomy list that wraps long names instead of cutting them off.
  wide?: boolean;
  // Sorted: A→Z by name (numbers first) instead of Material Library order.
  sorted?: boolean;
  // Shown in the box when nothing is picked yet (instead of the placeholder).
  fallbackText?: string;
}) {
  const meta = getMaterialCategory(category);
  const items = useMaterialItems(category);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // Purchase Material Library entries keep Brand in `description` and Colour Code in `name`; show Brand first.
  const parts = (i: { name: string; description: string }) =>
    meta.brandAndCode ? { main: i.description, sub: i.name } : { main: i.name, sub: i.description };
  const selected = items.find((i) => i.id === value);
  const matches = items.filter(
    (i) => i.name.toLowerCase().includes(query.toLowerCase()) || i.description.toLowerCase().includes(query.toLowerCase())
  );
  const results = sorted
    ? [...matches].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }))
    : matches;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary",
            disabled && "cursor-not-allowed bg-input/50 opacity-50",
            triggerClassName
          )}
        >
          {selected ? (
            <span
              title={nameOnly || !parts(selected).sub ? parts(selected).main : `${parts(selected).main} — ${parts(selected).sub}`}
              className={cn("min-w-0 truncate font-number", bold && "font-semibold")}
            >
              {parts(selected).main}
              {!nameOnly && parts(selected).sub && <span className="text-grey-400"> — {parts(selected).sub}</span>}
            </span>
          ) : (
            <span className={cn("min-w-0 truncate", fallbackText ? "font-number" : "text-grey-400")}>{fallbackText || `Select ${meta.label.toLowerCase()}`}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
        </PopoverTrigger>
        <PopoverContent align="start" className={cn("p-2", wide ? "w-[min(44rem,calc(100vw-2rem))]" : "w-72")}>
          <Input
            autoFocus
            placeholder={`Search ${meta.label.toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-2 font-number"
          />
          <div className={cn("flex flex-col overflow-y-auto", wide ? "max-h-80" : "max-h-52")}>
            {results.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  onChange(i.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full min-w-0 justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600",
                  wide ? "items-start" : "items-center",
                  i.id === value ? "text-primary" : "text-grey-800"
                )}
              >
                <span
                  title={nameOnly || !parts(i).sub ? parts(i).main : `${parts(i).main} — ${parts(i).sub}`}
                  className={cn("min-w-0 font-number", wide ? "break-words" : "truncate")}
                >
                  {parts(i).main}
                  {!nameOnly && parts(i).sub && <span className="text-grey-400"> — {parts(i).sub}</span>}
                </span>
                {i.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
            {results.length === 0 && (
              <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>
            )}
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
            Add new {meta.label.toLowerCase()}
          </button>
        </PopoverContent>
      </Popover>

      <MaterialItemFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        category={meta}
        onSubmit={(values) => {
          const created = materialSpecStore.createItem({ category, ...values });
          onChange(created.id);
        }}
      />
    </>
  );
}
