"use client";

import { createContext, useContext, useRef } from "react";
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
      // A colour not in this library's list (a Proforma Invoice showing its Purchase Order's colour) still shows as saved.
      fallbackText={value || undefined}
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
