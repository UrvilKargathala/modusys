"use client";

import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";

// A cabinet's name, picked from Material Library > Purchase Material Library > Cabinet Name (the name is saved as text).
// Shown as the cabinet's heading; `fallback` is the name it came with from the quote until another one is picked.
export function PoCabinetNameSelect({ value, fallback, onChange }: { value: string; fallback: string; onChange: (name: string) => void }) {
  const items = useMaterialItems("purchase-cabinet-type");
  return (
    <div className="min-w-0 max-w-[280px]">
      <MaterialReferenceSelect
        category="purchase-cabinet-type"
        nameOnly
        bold
        value={items.find((i) => i.name === (value || fallback))?.id ?? ""}
        fallbackText={value || fallback}
        triggerClassName="h-9 border-transparent bg-transparent px-2 font-heading text-base hover:border-grey-100"
        onChange={(id) => onChange(materialSpecStore.getSnapshot().find((m) => m.id === id)?.name ?? "")}
      />
    </div>
  );
}
