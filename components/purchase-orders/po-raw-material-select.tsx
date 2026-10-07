"use client";

import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";
import type { MaterialCategoryKey } from "@/lib/mock/material-spec";

// A name picked from a Material Library list (default Raw Material Type; Furniture Component for row descriptions); the PO keeps the name as text.
// A saved name that isn't in the library (older quotes, e.g. "BWP Ply+HDHMR") stays visible and editable as text
// until it is cleared, so nothing typed before is hidden.
export function PoRawMaterialSelect({ value, onChange, compact = false, category = "raw-material-type" }: { value: string; onChange: (name: string) => void; compact?: boolean; category?: MaterialCategoryKey }) {
  const items = useMaterialItems(category);
  const match = items.find((i) => i.name === value);
  if (value && !match) {
    return (
      <input
        className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm font-body text-grey-900 outline-none hover:border-grey-100 focus:border-primary focus:bg-card"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <MaterialReferenceSelect
      category={category}
      nameOnly={category === "furniture-component"}
      value={match?.id ?? ""}
      triggerClassName={compact ? "h-8 py-1 text-[13px]" : undefined}
      onChange={(id) => onChange(materialSpecStore.getSnapshot().find((m) => m.id === id)?.name ?? "")}
    />
  );
}
