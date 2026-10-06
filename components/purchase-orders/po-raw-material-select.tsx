"use client";

import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";

// Raw material picked from Material Library > Raw Material Type; the PO keeps the name as text.
export function PoRawMaterialSelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const items = useMaterialItems("raw-material-type");
  return (
    <MaterialReferenceSelect
      category="raw-material-type"
      value={items.find((i) => i.name === value)?.id ?? ""}
      onChange={(id) => onChange(materialSpecStore.getSnapshot().find((m) => m.id === id)?.name ?? "")}
    />
  );
}
