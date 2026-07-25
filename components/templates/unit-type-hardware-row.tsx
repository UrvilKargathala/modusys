"use client";

import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { rateAfterDiscount } from "@/lib/mock/pricing-list";
import { cn } from "@/lib/utils";
import type { UnitTypeHardware } from "@/lib/mock/unit-type";

// Article No. is a free text field. Brand and Description each pick from
// Hardware Price List distinct values (unfiltered by Category so the user
// isn't gated by a category choice). Level Type is picked from Material
// Library. Unit and Rate are still derived when a specific HPL item is
// pointed at via hardwareItemId; otherwise they show "—".
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
  const unitName = (id?: string) => units.find((u) => u.id === id)?.name ?? "—";

  // Filter hardware items by the row's selected category, so Brand and
  // Description narrow to just that category's SKUs. If no category picked,
  // show the whole list.
  const itemsForCategory = useMemo(
    () => (value.categoryId ? hardwareItems.filter((h) => h.categoryId === value.categoryId) : hardwareItems),
    [hardwareItems, value.categoryId]
  );

  // Distinct brand ids that show up in the (category-filtered) Hardware
  // Price List.
  const brandOptions = useMemo(() => {
    const ids = new Set(itemsForCategory.map((h) => h.brandId).filter(Boolean));
    return brands.filter((b) => ids.has(b.id));
  }, [itemsForCategory, brands]);

  // Distinct product descriptions from the (category-filtered) Hardware
  // Price List.
  const descriptionOptions = useMemo(
    () => Array.from(new Set(itemsForCategory.map((h) => h.description).filter(Boolean))).sort(),
    [itemsForCategory]
  );

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
          <Label htmlFor={`hw-art-${value.id}`}>Article No.</Label>
          <Input
            id={`hw-art-${value.id}`}
            placeholder="e.g. BLM-CLIP-110"
            value={value.articleNo ?? ""}
            onChange={(e) => onChange({ articleNo: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Category</Label>
          <MaterialReferenceSelect
            category="category"
            value={value.categoryId}
            onChange={(id) => onChange({ categoryId: id })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`hw-brand-${value.id}`}>Brand</Label>
          <select
            id={`hw-brand-${value.id}`}
            value={value.brandId ?? ""}
            onChange={(e) => onChange({ brandId: e.target.value })}
            className="w-full rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
          >
            <option value="">Select brand</option>
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`hw-desc-${value.id}`}>Description</Label>
          <select
            id={`hw-desc-${value.id}`}
            value={value.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
          >
            <option value="">Select description</option>
            {descriptionOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Level Type</Label>
          <MaterialReferenceSelect
            category="level-type"
            value={value.levelTypeId ?? ""}
            onChange={(id) => onChange({ levelTypeId: id })}
          />
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

    </div>
  );
}
