"use client";

import { useState } from "react";
import { CabinetTypeFormDialog } from "@/components/templates/cabinet-type-form-dialog";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { TextReferenceSelect } from "@/components/shared/text-reference-select";
import { cabinetTypeStore, useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";

// A cabinet's type, picked from Templates > Cabinet Type (active types). The name is saved as text and the
// type's id is passed along so Auto Populate uses that type's formulas.
// Shown as the cabinet's heading; `fallback` is the name it came with from the quote until another one is picked.
export function PoCabinetNameSelect({ value, fallback, onChange, field = false }: { value: string; fallback: string; onChange: (name: string, cabinetTypeId: string) => void; field?: boolean }) {
  const types = useCabinetTypes().filter((t) => t.active && !t.deleted);
  // "+ Add new cabinet type" opens the same Add dialog as Templates > Cabinet Type and selects the new type.
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div className={field ? "min-w-0" : "min-w-0 max-w-[280px]"}>
      <TextReferenceSelect
        label="Cabinet Type"
        options={types.map((t) => t.name)}
        value={value || fallback}
        triggerClassName={field ? "h-9 text-[13px]" : "h-9 border-transparent bg-transparent px-2 font-heading text-base font-semibold hover:border-grey-100"}
        onAddNew={() => setAddOpen(true)}
        onChange={(name) => onChange(name, types.find((t) => t.name === name)?.id ?? "")}
      />
      <CabinetTypeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) => {
          const created = cabinetTypeStore.createCabinetType(values);
          onChange(created.name, created.id);
        }}
      />
    </div>
  );
}

// A labelled Cabinet Name field (own value, separate from the heading), from the same library list.
export function PoCabinetNameField({ value, onChange, stacked = false }: { value: string; onChange: (name: string) => void; stacked?: boolean }) {
  const items = useMaterialItems("purchase-cabinet-type");
  if (stacked)
    return (
      <MaterialReferenceSelect
        category="purchase-cabinet-type"
        nameOnly
        value={items.find((i) => i.name === value)?.id ?? ""}
        triggerClassName="h-9 text-[13px]"
        onChange={(id) => onChange(materialSpecStore.getSnapshot().find((m) => m.id === id)?.name ?? "")}
      />
    );
  return (
    <label className="flex shrink-0 items-center gap-1 text-xs text-grey-500">
      Cabinet Name
      <div className="w-36">
        <MaterialReferenceSelect
          category="purchase-cabinet-type"
          nameOnly
          value={items.find((i) => i.name === value)?.id ?? ""}
          triggerClassName="h-8 py-1 text-[13px]"
          onChange={(id) => onChange(materialSpecStore.getSnapshot().find((m) => m.id === id)?.name ?? "")}
        />
      </div>
    </label>
  );
}
