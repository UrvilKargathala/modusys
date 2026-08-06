"use client";

import { useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, AlertTriangle, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { FurniturePriceFormDialog } from "@/components/templates/furniture-price-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useFurniturePriceItems, pricingListStore } from "@/lib/store/pricing-list-store";
import { cn } from "@/lib/utils";
import type { CabinetComponent } from "@/lib/mock/cabinet-type";

const materialFieldLabel: Record<string, string> = {
  componentTypeId: "Component Name",
  thicknessId: "Thickness",
  rawMaterialTypeId: "Raw Material",
  internalColourId: "Internal Colour",
  externalColourId: "External Colour",
};

export function CabinetTypeComponentRow({
  value,
  onChange,
  onRemove,
}: {
  value: CabinetComponent;
  onChange: (patch: Partial<CabinetComponent>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: value.id });
  const [addPriceOpen, setAddPriceOpen] = useState(false);
  const [pendingMaterialChange, setPendingMaterialChange] = useState<{ field: string; id: string } | null>(null);

  const furnitureItems = useFurniturePriceItems();
  const combinationComplete =
    !!value.thicknessId && !!value.rawMaterialTypeId && !!value.internalColourId && !!value.externalColourId;

  const requestMaterialChange = (field: string, id: string) => {
    const current = value[field as keyof CabinetComponent];
    if (current) {
      setPendingMaterialChange({ field, id });
    } else {
      onChange({ [field]: id });
    }
  };

  const match = useMemo(() => {
    if (!combinationComplete) return null;
    return (
      furnitureItems.find(
        (i) =>
          i.thicknessId === value.thicknessId &&
          i.rawMaterialTypeId === value.rawMaterialTypeId &&
          i.internalColourId === value.internalColourId &&
          i.externalColourId === value.externalColourId
      ) ?? null
    );
  }, [furnitureItems, combinationComplete, value.thicknessId, value.rawMaterialTypeId, value.internalColourId, value.externalColourId]);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-lg border border-grey-100 bg-card p-3", isDragging && "opacity-50")}
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-grey-300 hover:text-grey-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-xs font-body font-medium uppercase tracking-wide text-grey-400">Component</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove component"
          className="ml-auto rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label>Component Name</Label>
          <MaterialReferenceSelect
            category="furniture-component"
            value={value.componentTypeId}
            onChange={(id) => requestMaterialChange("componentTypeId", id)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`w-${value.id}`}>Width (W)</Label>
          <Input
            id={`w-${value.id}`}
            placeholder="e.g. (W-95)/2"
            value={value.widthFormula}
            onChange={(e) => onChange({ widthFormula: e.target.value })}
            className="font-number"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`h-${value.id}`}>Height (H)</Label>
          <Input
            id={`h-${value.id}`}
            placeholder="e.g. H-20"
            value={value.heightFormula}
            onChange={(e) => onChange({ heightFormula: e.target.value })}
            className="font-number"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Thickness</Label>
          <MaterialReferenceSelect
            category="thickness"
            value={value.thicknessId}
            onChange={(id) => requestMaterialChange("thicknessId", id)}
            triggerClassName="font-number"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Raw Material Type</Label>
          <MaterialReferenceSelect
            category="raw-material-type"
            value={value.rawMaterialTypeId}
            onChange={(id) => requestMaterialChange("rawMaterialTypeId", id)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Internal Colour</Label>
          <MaterialReferenceSelect
            category="internal-colour"
            value={value.internalColourId}
            onChange={(id) => requestMaterialChange("internalColourId", id)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>External Colour</Label>
          <MaterialReferenceSelect
            category="external-colour"
            value={value.externalColourId}
            onChange={(id) => requestMaterialChange("externalColourId", id)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`qty-${value.id}`}>Quantity (Qty)</Label>
          <Input
            id={`qty-${value.id}`}
            type="number"
            min={1}
            className="font-number"
            value={value.qty || ""}
            onChange={(e) => onChange({ qty: Number(e.target.value) })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Rate</Label>
          {match ? (
            <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-number font-semibold text-grey-700">
              {match.rate.toFixed(2)}/sq.ft
            </div>
          ) : (
            <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body text-grey-400">
              —
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor={`remarks-${value.id}`}>Remarks</Label>
          <Input
            id={`remarks-${value.id}`}
            placeholder="Optional note for this component"
            value={value.remarks ?? ""}
            onChange={(e) => onChange({ remarks: e.target.value })}
          />
        </div>
      </div>

      {combinationComplete && !match && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-warning-transparent px-3 py-2 text-sm font-body text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          No price found for this combination.
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAddPriceOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add this combination to Furniture Price List
          </Button>
        </div>
      )}

      <FurniturePriceFormDialog
        open={addPriceOpen}
        onOpenChange={setAddPriceOpen}
        initialValues={{
          thicknessId: value.thicknessId,
          rawMaterialTypeId: value.rawMaterialTypeId,
          internalColourId: value.internalColourId,
          externalColourId: value.externalColourId,
        }}
        onSubmit={(values) => pricingListStore.createFurnitureItem(values)}
        onEditExisting={() => setAddPriceOpen(false)}
      />

      <ConfirmDialog
        open={pendingMaterialChange !== null}
        onOpenChange={(open) => !open && setPendingMaterialChange(null)}
        title={`Change ${pendingMaterialChange ? materialFieldLabel[pendingMaterialChange.field] : ""}?`}
        description="This changes the price-list match for this component, which updates its Rate."
        confirmLabel="Change"
        onConfirm={() => {
          if (pendingMaterialChange) onChange({ [pendingMaterialChange.field]: pendingMaterialChange.id });
        }}
      />
    </div>
  );
}
