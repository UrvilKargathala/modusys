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
}: {
  category: MaterialCategoryKey;
  value: string;
  onChange: (id: string) => void;
  nameOnly?: boolean;
  bold?: boolean;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const meta = getMaterialCategory(category);
  const items = useMaterialItems(category);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const selected = items.find((i) => i.id === value);
  const results = items.filter(
    (i) => i.name.toLowerCase().includes(query.toLowerCase()) || i.description.toLowerCase().includes(query.toLowerCase())
  );

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
            <span className={cn("min-w-0 truncate font-number", bold && "font-semibold")}>
              {selected.name}
              {!nameOnly && selected.description && <span className="text-grey-400"> — {selected.description}</span>}
            </span>
          ) : (
            <span className="min-w-0 truncate text-grey-400">Select {meta.label.toLowerCase()}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <Input
            autoFocus
            placeholder={`Search ${meta.label.toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-2 font-number"
          />
          <div className="flex max-h-52 flex-col overflow-y-auto">
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
                  "flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600",
                  i.id === value ? "text-primary" : "text-grey-800"
                )}
              >
                <span className="min-w-0 truncate font-number">
                  {i.name}
                  {!nameOnly && i.description && <span className="text-grey-400"> — {i.description}</span>}
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
