"use client";

import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";

// Design type of a cabinet, picked from Material Library > Purchase Material Library > Cabinet Type.
export function PoDesignSelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const items = useMaterialItems("purchase-cabinet-type");
  return (
    <label className="flex items-center gap-1 text-xs text-grey-500">
      Cabinet Type
      <div className="w-36">
        <MaterialReferenceSelect
          category="purchase-cabinet-type"
          value={items.find((i) => i.name === value)?.id ?? ""}
          triggerClassName="h-8 py-1 text-[13px]"
          onChange={(id) => onChange(materialSpecStore.getSnapshot().find((m) => m.id === id)?.name ?? "")}
        />
      </div>
    </label>
  );
}
