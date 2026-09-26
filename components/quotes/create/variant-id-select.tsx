"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useFurniturePriceItems } from "@/lib/store/pricing-list-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import type { FurniturePriceItem } from "@/lib/mock/pricing-list";
import { cn } from "@/lib/utils";

// Searchable picker over the Furniture Price List's Variant IDs. Picking one
// hands back the whole price row so the caller can fill Thickness / Raw
// Material / Internal / External from it in one go.
export function VariantIdSelect({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (item: FurniturePriceItem) => void;
}) {
  const allItems = useFurniturePriceItems();
  const thicknesses = useMaterialItems("thickness");
  const rawMaterials = useMaterialItems("raw-material-type");
  const internals = useMaterialItems("internal-colour");
  const externals = useMaterialItems("external-colour");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const nameOf = (list: { id: string; name: string }[], id: string) => list.find((m) => m.id === id)?.name ?? "—";
  const describe = (i: FurniturePriceItem) =>
    [nameOf(thicknesses, i.thicknessId), nameOf(rawMaterials, i.rawMaterialTypeId), nameOf(internals, i.internalColourId), nameOf(externals, i.externalColourId)].join(" · ");

  const items = allItems.filter((i) => !i.deleted && i.variantId).sort((a, b) => a.variantId.localeCompare(b.variantId));
  const selected = items.find((i) => i.id === selectedId);
  const q = query.trim().toLowerCase();
  const results = q ? items.filter((i) => i.variantId.toLowerCase().includes(q) || describe(i).toLowerCase().includes(q)) : items;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary">
        {selected ? (
          <span title={describe(selected)} className="min-w-0 truncate font-number">
            {selected.variantId}
          </span>
        ) : (
          <span className="min-w-0 truncate text-grey-400">Select variant ID</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <Input
          autoFocus
          placeholder="Search variant ID or material"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2 font-number"
        />
        <div className="flex max-h-64 flex-col overflow-y-auto">
          {results.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => {
                onSelect(i);
                setOpen(false);
                setQuery("");
              }}
              className={cn(
                "flex w-full min-w-0 items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-light-600",
                i.id === selectedId ? "text-primary" : "text-grey-800"
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-number font-medium">{i.variantId}</span>
                <span className="truncate text-xs font-body text-grey-400">{describe(i)}</span>
              </span>
              {i.id === selectedId && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
          {results.length === 0 && (
            <span className="px-2 py-1.5 text-sm font-body text-grey-400">
              {items.length === 0 ? "No variant IDs yet — add them in Templates → Pricing List." : "No matches"}
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
