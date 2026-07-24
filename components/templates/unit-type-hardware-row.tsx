"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { rateAfterDiscount } from "@/lib/mock/pricing-list";
import { cn } from "@/lib/utils";
import type { UnitTypeHardware } from "@/lib/mock/unit-type";

// Category → Description → (Brand/Unit/Rate/Article No. read off the
// matched Hardware Price List item, never stored redundantly here). If the
// referenced item was deleted/deactivated since being picked, `matched` is
// undefined and the row falls back to the same "no match found" warning
// used by Components/External Finish.
export function UnitTypeHardwareRow({
  value,
  onChange,
  onRemove,
}: {
  value: UnitTypeHardware;
  onChange: (patch: Partial<UnitTypeHardware>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: value.id });

  const hardwareItems = useHardwarePriceItems();
  const brands = useMaterialItems("brand");
  const units = useMaterialItems("unit");
  const brandName = (id?: string) => brands.find((b) => b.id === id)?.name ?? "—";
  const unitName = (id?: string) => units.find((u) => u.id === id)?.name ?? "—";

  const optionsForCategory = hardwareItems.filter((h) => h.categoryId === value.categoryId);
  const matched = hardwareItems.find((h) => h.id === value.hardwareItemId);

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
        <span className="text-xs font-body font-medium uppercase tracking-wide text-grey-400">Hardware</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove hardware"
          className="ml-auto rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>div]:min-w-0">
        <div className="flex flex-col gap-1.5">
          <Label>Article No.</Label>
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body text-grey-700">
            {matched?.articleNo ?? "—"}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Category</Label>
          <MaterialReferenceSelect
            category="category"
            value={value.categoryId}
            onChange={(id) => onChange({ categoryId: id, hardwareItemId: "" })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Brand</Label>
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body text-grey-700">
            {matched ? brandName(matched.brandId) : "—"}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`hw-desc-${value.id}`}>Description</Label>
          <select
            id={`hw-desc-${value.id}`}
            disabled={!value.categoryId}
            value={value.hardwareItemId}
            onChange={(e) => onChange({ hardwareItemId: e.target.value })}
            className="w-full rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary disabled:bg-light-600 disabled:text-grey-400"
          >
            <option value="">{value.categoryId ? "Select item" : "Select a category first"}</option>
            {optionsForCategory.map((h) => (
              <option key={h.id} value={h.id}>
                {h.articleNo} — {h.description || "—"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`hw-qty-${value.id}`}>Quantity (Qty)</Label>
          <Input
            id={`hw-qty-${value.id}`}
            placeholder="e.g. 2 or H/450"
            value={value.qtyFormula}
            onChange={(e) => onChange({ qtyFormula: e.target.value })}
          />
          <span className="text-xs font-body text-grey-400">Enter a number or a formula using W, D, H (e.g. H/450).</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Unit</Label>
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body text-grey-700">
            {matched ? unitName(matched.unitId) : "—"}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Rate</Label>
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body font-semibold text-grey-700">
            {matched ? `₹${rateAfterDiscount(matched).toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      {value.hardwareItemId && !matched && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-warning-transparent px-3 py-2 text-sm font-body text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          No match found — this item may have been removed or deactivated in Hardware Price List.
        </div>
      )}
    </div>
  );
}
