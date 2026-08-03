"use client";

import { useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, AlertTriangle, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { FurniturePriceFormDialog } from "@/components/templates/furniture-price-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useFurniturePriceItems, pricingListStore } from "@/lib/store/pricing-list-store";
import { cn } from "@/lib/utils";
import type { FurnitureLineItem } from "@/lib/mock/unit-type";

const materialFieldLabel: Record<string, string> = {
  thicknessId: "Thickness",
  rawMaterialTypeId: "Raw Material",
  internalColourId: "Internal Colour",
  externalColourId: "External Colour",
};

// Shared by Unit Type's Components and External Finish tabs (and could
// replace Cabinet Type's near-identical row too) — same four-way material
// combination drives the same Furniture Price List lookup either way.
// `showComponentName` toggles the Furniture Component picker, the one field
// that's meaningful for Components but not External Finish.
export function FurnitureLineItemRow({
  value,
  onChange,
  onRemove,
  label,
  showComponentName,
  showLevelType,
  totalSqFt,
  compact,
}: {
  value: FurnitureLineItem;
  onChange: (patch: Partial<FurnitureLineItem>) => void;
  onRemove: () => void;
  label: string;
  showComponentName: boolean;
  // Opt-in Level Type picker (Material Library) — only shown where wanted
  // (e.g. Other Panel), not on every furniture line.
  showLevelType?: boolean;
  // Quotes-only — a concrete Unit's W/D/H is needed to evaluate the width/
  // height formulas into a real area, which Templates (Unit Type/Cabinet
  // Type builders) never have, so this stays optional and Templates simply
  // omits it.
  totalSqFt?: number;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: value.id });
  const [addPriceOpen, setAddPriceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingMaterialChange, setPendingMaterialChange] = useState<{ field: string; id: string } | null>(null);

  const furnitureItems = useFurniturePriceItems();
  const combinationComplete =
    !!value.thicknessId && !!value.rawMaterialTypeId && !!value.internalColourId && !!value.externalColourId;

  // Editing a snapshotted row (one that came from a Cabinet Type group, not
  // manually added) marks it "Customized" the first time any field changes.
  const handleFieldChange = (patch: Partial<FurnitureLineItem>) => {
    if (value.sourceLinkId && !value.isExtra && !value.isCustomized) {
      onChange({ ...patch, isCustomized: true });
    } else {
      onChange(patch);
    }
  };

  // Thickness/Raw Material/Internal/External Colour drive the price-list
  // lookup — changing any of them changes Rate/Amount, so confirm before
  // applying rather than silently reprice the row.
  const requestMaterialChange = (field: string, id: string) => setPendingMaterialChange({ field, id });

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

  // Manual override wins — same rule quote-pricing.ts's effectiveFurnitureRate
  // applies for Amount/subtotal/quote-total math, kept in sync here so the
  // row's own display never disagrees with those totals.
  const effectiveRate = value.rateOverride ?? match?.rate;

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
        <span className="text-xs font-body font-medium uppercase tracking-wide text-grey-400">{label}</span>
        {value.isExtra && (
          <span className="rounded-full bg-grey-transparent px-2 py-0.5 text-xs font-body font-medium text-grey-600">
            + Custom
          </span>
        )}
        {!value.isExtra && value.isCustomized && (
          <span className="rounded-full bg-secondary-transparent px-2 py-0.5 text-xs font-body font-medium text-secondary">
            Customized
          </span>
        )}
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          aria-label={`Remove ${label.toLowerCase()}`}
          className="ml-auto rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className={cn("grid gap-x-3 gap-y-3 [&>div]:min-w-0", compact ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6")}>
        {showComponentName && (
          <div className="flex flex-col gap-1.5">
            <Label className="whitespace-nowrap">Component Name</Label>
            <MaterialReferenceSelect
              category="furniture-component"
              value={value.componentTypeId ?? ""}
              onChange={(id) => handleFieldChange({ componentTypeId: id })}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`w-${value.id}`}>Width</Label>
          <Input
            id={`w-${value.id}`}
            placeholder="e.g. (W-95)/2"
            value={value.widthFormula}
            onChange={(e) => handleFieldChange({ widthFormula: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`h-${value.id}`}>Height</Label>
          <Input
            id={`h-${value.id}`}
            placeholder="e.g. H-20"
            value={value.heightFormula}
            onChange={(e) => handleFieldChange({ heightFormula: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`qty-${value.id}`}>Qty</Label>
          <Input
            id={`qty-${value.id}`}
            type="number"
            min={1}
            className="font-number"
            value={value.qty || ""}
            onChange={(e) => handleFieldChange({ qty: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Thickness</Label>
          <MaterialReferenceSelect
            category="thickness"
            value={value.thicknessId}
            onChange={(id) => requestMaterialChange("thicknessId", id)}
          />
        </div>
        {totalSqFt !== undefined && (
          <div className="flex flex-col gap-1.5">
            <Label>Total sq.ft</Label>
            <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-number font-semibold text-grey-700">
              {totalSqFt.toFixed(2)}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label>Amount</Label>
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-number font-semibold text-grey-900">
            {totalSqFt !== undefined
              ? `₹${(effectiveRate !== undefined ? effectiveRate * totalSqFt : 0).toFixed(2)}`
              : "—"}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Rate</Label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="0.00"
              value={value.rateOverride ?? (match ? match.rate.toFixed(2) : "")}
              onChange={(e) => {
                const raw = e.target.value;
                handleFieldChange({ rateOverride: raw === "" ? undefined : Number(raw) });
              }}
              className="pr-14 font-number"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-grey-400">/sq.ft</span>
          </div>
          {value.rateOverride !== undefined && match && value.rateOverride !== match.rate && (
            <button
              type="button"
              onClick={() => handleFieldChange({ rateOverride: undefined })}
              className="w-fit text-xs font-body text-primary hover:underline"
            >
              Reset to price-list rate (<span className="font-number">₹{match.rate.toFixed(2)}</span>)
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Raw Material</Label>
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
        {showLevelType && (
          <div className="flex flex-col gap-1.5">
            <Label>Level Type</Label>
            <MaterialReferenceSelect
              category="level-type"
              value={value.levelTypeId ?? ""}
              onChange={(id) => handleFieldChange({ levelTypeId: id })}
            />
          </div>
        )}
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
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Remove this ${label.toLowerCase()}?`}
        description="This removes the line item and its pricing from the quote."
        onConfirm={onRemove}
      />

      <ConfirmDialog
        open={pendingMaterialChange !== null}
        onOpenChange={(open) => !open && setPendingMaterialChange(null)}
        title={`Change ${pendingMaterialChange ? materialFieldLabel[pendingMaterialChange.field] : ""}?`}
        description="This changes the price-list match for this line item, which updates its Rate and Amount."
        confirmLabel="Change"
        onConfirm={() => {
          if (pendingMaterialChange) handleFieldChange({ [pendingMaterialChange.field]: pendingMaterialChange.id });
        }}
      />
    </div>
  );
}
