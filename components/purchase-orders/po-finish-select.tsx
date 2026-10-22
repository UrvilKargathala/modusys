"use client";

import { createContext, useContext, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useLibKey } from "@/components/purchase-orders/po-library-context";
import { ColourPopover } from "@/components/shared/colour-popover";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";
import type { MaterialItem } from "@/lib/mock/material-spec";

// PO lines keep their internal/external finish as a text snapshot ("Brand — Colour code"),
// picked from the Purchase Material Library (Brand in `description`, Colour Code in `name`).
export const DEFAULT_HIGHLIGHT = "#fde68a";
export const finishLabel = (i: Pick<MaterialItem, "name" | "description">) => `${i.description} — ${i.name}`;

// The colours chosen in Material Details (Primary + Secondary): the Internal / External pickers on the cabinets and rows list only these.
// null (or an empty list) = no restriction.
export const PoAllowedColoursContext = createContext<{ internal: string[]; external: string[] } | null>(null);

export function PoFinishSelect({
  kind,
  value,
  onChange,
  colors,
  onColor,
  free = false,
}: {
  // free: list every colour (the Material Details pickers themselves).
  free?: boolean;
  kind: "internal" | "external";
  // The saved text snapshot; "" = nothing picked.
  value: string;
  onChange: (label: string) => void;
  // Optional highlight colour per label: a colour picker opens when a finish is picked, and a swatch beside the box changes it.
  colors?: Record<string, string>;
  onColor?: (label: string, hex: string) => void;
}) {
  const category = useLibKey(kind === "internal" ? "purchase-internal" : "purchase-internal");
  const items = useMaterialItems(category);
  const selected = items.find((i) => finishLabel(i) === value);
  const allowed = useContext(PoAllowedColoursContext)?.[kind];
  const only = !free && allowed && allowed.length > 0 ? allowed : null;
  const pending = useRef<string>("");
  const select = (
    <MaterialReferenceSelect
      category={category}
      filter={only ? (i) => only.includes(finishLabel(i)) : undefined}
      value={selected?.id ?? ""}
      triggerClassName="h-8 py-1 text-[13px]"
      onChange={(id) => {
        const item = materialSpecStore.getSnapshot().find((m) => m.id === id);
        const label = item ? finishLabel(item) : "";
        onChange(label);
        if (onColor && label) {
          pending.current = label;
          if (!colors?.[label]) onColor(label, DEFAULT_HIGHLIGHT);
        }
      }}
    />
  );
  if (!onColor) return select;
  return (
    <div className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1">{select}</div>
      <ColourPopover value={colors?.[value] ?? DEFAULT_HIGHLIGHT} onChange={(hex) => onColor(value, hex)} reset={DEFAULT_HIGHLIGHT} disabled={!value} label={`Highlight colour for the ${kind} brand & colour`} />
    </div>
  );
}

// Several external brand & colour picks at once (Purchase Material Library > External). Values are the same text labels
// as PoFinishSelect; this is information only, nothing reads it to price or fill rows.
export function PoFinishMultiSelect({
  value,
  onChange,
  colors = {},
  onColorChange,
  kind = "external",
  placeholder,
}: {
  // Which Material Library list the picks come from (default External); placeholder replaces "Select brand & colours".
  kind?: "internal" | "external";
  placeholder?: string;
  value: string[];
  onChange: (labels: string[]) => void;
  // A highlight colour per pick (hex); the colour picker opens as soon as a pick is added, and a swatch beside each pick changes it.
  colors?: Record<string, string>;
  onColorChange?: (label: string, hex: string) => void;
}) {
  const items = useMaterialItems(useLibKey(kind === "internal" ? "purchase-internal" : "purchase-internal"));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();
  const results = items.filter((i) => finishLabel(i).toLowerCase().includes(q));
  const toggle = (label: string) => {
    const adding = !value.includes(label);
    onChange(adding ? [...value, label] : value.filter((v) => v !== label));
    if (adding && onColorChange) {
      // Give it a colour straight away; the swatch beside it changes it.
      if (!colors[label]) onColorChange(label, DEFAULT_HIGHLIGHT);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-left text-sm font-body text-grey-900 outline-none focus:border-primary">
        {value.length === 0 ? (
          <span className="text-grey-400">{placeholder ?? "Select brand & colours"}</span>
        ) : (
          <span className="flex min-w-0 flex-wrap gap-1">
            {value.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded-md bg-light-600 px-1.5 py-0.5 font-number text-[12px] text-grey-700">
                {onColorChange && <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-grey-200" style={{ backgroundColor: colors[v] ?? DEFAULT_HIGHLIGHT }} />}
                {v}
                {/* Remove just this colour without opening the list. */}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${v}`}
                  onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange(value.filter((x) => x !== v)); } }}
                  className="ml-0.5 cursor-pointer rounded px-0.5 text-grey-400 hover:bg-grey-100 hover:text-error"
                >
                  ×
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <Input autoFocus placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2 font-number" />
        <div className="flex max-h-56 flex-col overflow-y-auto">
          {results.map((i) => {
            const label = finishLabel(i);
            const on = value.includes(label);
            return (
              <div key={i.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggle(label)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600 ${on ? "text-primary" : "text-grey-800"}`}
              >
                <span className="min-w-0 font-number">{label}</span>
                {on && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
              {onColorChange && on && <ColourPopover value={colors[label] ?? DEFAULT_HIGHLIGHT} onChange={(hex) => onColorChange(label, hex)} reset={DEFAULT_HIGHLIGHT} label={`Highlight colour for ${label}`} />}
              </div>
            );
          })}
          {results.length === 0 && <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>}
        </div>
        <div className="mt-2 flex justify-end border-t border-grey-100 pt-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-md bg-primary px-4 py-1 text-sm font-body font-medium text-white hover:opacity-90">OK</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
