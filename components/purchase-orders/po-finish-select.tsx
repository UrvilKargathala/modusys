"use client";

import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";
import type { MaterialItem } from "@/lib/mock/material-spec";

// PO lines keep their internal/external finish as a text snapshot ("Brand — Colour code"),
// picked from the Purchase Material Library (Brand in `description`, Colour Code in `name`).
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
