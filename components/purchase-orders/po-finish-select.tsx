"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";
import type { MaterialItem } from "@/lib/mock/material-spec";

// PO lines keep their internal/external finish as a text snapshot ("Brand — Colour code"),
// picked from the Purchase Material Library (Brand in `description`, Colour Code in `name`).
export const DEFAULT_HIGHLIGHT = "#fde68a";
export const finishLabel = (i: Pick<MaterialItem, "name" | "description">) => `${i.description} — ${i.name}`;

export function PoFinishSelect({
  kind,
  value,
  onChange,
}: {
  kind: "internal" | "external";
  // The saved text snapshot; "" = nothing picked.
  value: string;
  onChange: (label: string) => void;
}) {
  const category = kind === "internal" ? "purchase-internal" : "purchase-external";
  const items = useMaterialItems(category);
  const selected = items.find((i) => finishLabel(i) === value);
  return (
    <MaterialReferenceSelect
      category={category}
      value={selected?.id ?? ""}
      triggerClassName="h-8 py-1 text-[13px]"
      onChange={(id) => {
        const item = materialSpecStore.getSnapshot().find((m) => m.id === id);
        onChange(item ? finishLabel(item) : "");
      }}
    />
  );
}

// Several external brand & colour picks at once (Purchase Material Library > External). Values are the same text labels
// as PoFinishSelect; this is information only, nothing reads it to price or fill rows.
export function PoFinishMultiSelect({
  value,
  onChange,
  colors = {},
  onColorChange,
}: {
  value: string[];
  onChange: (labels: string[]) => void;
  // A highlight colour per pick (hex); the colour picker opens as soon as a pick is added, and a swatch beside each pick changes it.
  colors?: Record<string, string>;
  onColorChange?: (label: string, hex: string) => void;
}) {
  const pickers = useRef<Record<string, HTMLInputElement | null>>({});
  const items = useMaterialItems("purchase-external");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();
  const results = items.filter((i) => finishLabel(i).toLowerCase().includes(q));
  const toggle = (label: string) => {
    const adding = !value.includes(label);
    onChange(adding ? [...value, label] : value.filter((v) => v !== label));
    if (adding && onColorChange) {
      // Give it a colour straight away, then open the picker (inside the click, so the browser allows it).
      if (!colors[label]) onColorChange(label, DEFAULT_HIGHLIGHT);
      try { pickers.current[label]?.showPicker(); } catch { /* the swatch still works */ }
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-left text-sm font-body text-grey-900 outline-none focus:border-primary">
        {value.length === 0 ? (
          <span className="text-grey-400">Select brand &amp; colours</span>
        ) : (
          <span className="flex min-w-0 flex-wrap gap-1">
            {value.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded-md bg-light-600 px-1.5 py-0.5 font-number text-[12px] text-grey-700">
                {onColorChange && <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-grey-200" style={{ backgroundColor: colors[v] ?? DEFAULT_HIGHLIGHT }} />}
                {v}
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
              {onColorChange && (
                <input
                  ref={(el) => { pickers.current[label] = el; }}
                  type="color"
                  aria-label={`Highlight colour for ${label}`}
                  value={colors[label] ?? DEFAULT_HIGHLIGHT}
                  onChange={(e) => onColorChange(label, e.target.value)}
                  className={on ? "h-7 w-8 shrink-0 cursor-pointer rounded border border-grey-100 bg-transparent p-0.5" : "pointer-events-none absolute h-0 w-0 opacity-0"}
                />
              )}
              </div>
            );
          })}
          {results.length === 0 && <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
