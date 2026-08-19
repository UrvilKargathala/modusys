"use client";

import { useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Copy, X, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
  onCopy,
  rateReadOnly,
  collapsible,
}: {
  value: UnitTypeHardware;
  onChange: (patch: Partial<UnitTypeHardware>) => void;
  onRemove: () => void;
  onCopy?: () => void;
  rateReadOnly?: boolean;
  // Templates' Unit Type builder only — Quotes keeps every row always
  // expanded since users are actively pricing there.
  collapsible?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: value.id });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{ label: string; patch: Partial<UnitTypeHardware> } | null>(null);
  const [collapsed, setCollapsed] = useState(!!collapsible);

  const commit = (label: string, patch: Partial<UnitTypeHardware>) => {
    const hasExisting = Object.keys(patch).some((k) => value[k as keyof UnitTypeHardware]);
    if (hasExisting) {
      setPendingChange({ label, patch });
    } else {
      onChange(patch);
    }
  };

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

  // Description is further narrowed by the picked brand — matches the
  // Hardware Price List's real category → brand → description hierarchy.
  const itemsForCategoryAndBrand = useMemo(
    () => (value.brandId ? itemsForCategory.filter((h) => h.brandId === value.brandId) : itemsForCategory),
    [itemsForCategory, value.brandId]
  );

  // Distinct brand ids that show up in the (category-filtered) Hardware
  // Price List.
  const brandOptions = useMemo(() => {
    const ids = new Set(itemsForCategory.map((h) => h.brandId).filter(Boolean));
    return brands.filter((b) => ids.has(b.id));
  }, [itemsForCategory, brands]);

  // Distinct product descriptions from the (category+brand-filtered) HPL.
  const descriptionOptions = useMemo(
    () => Array.from(new Set(itemsForCategoryAndBrand.map((h) => h.description).filter(Boolean))).sort(),
    [itemsForCategoryAndBrand]
  );

  const matched = hardwareItems.find((h) => h.id === value.hardwareItemId);

  // Whenever category/brand/description narrows to a single HPL SKU, pin it
  // as hardwareItemId so Unit/Rate/Amount resolve. Also back-fill any of
  // Category/Brand/Article No./Level Type/description the user hasn't set
  // yet, so picking one end of the chain fills the rest.
  const resolveFromCombo = (
    patch: Partial<UnitTypeHardware>,
    current: UnitTypeHardware
  ): Partial<UnitTypeHardware> => {
    const next = { ...current, ...patch };
    const candidates = hardwareItems.filter(
      (h) =>
        (!next.categoryId || h.categoryId === next.categoryId) &&
        (!next.brandId || h.brandId === next.brandId) &&
        (!next.description || h.description === next.description)
    );
    if (candidates.length === 1) {
      const item = candidates[0];
      return {
        ...patch,
        hardwareItemId: item.id,
        articleNo: item.articleNo,
        categoryId: item.categoryId,
        brandId: item.brandId,
        description: item.description,
        levelTypeId: current.levelTypeId || item.levelTypeId || current.levelTypeId,
      };
    }
    // Not unique — clear any stale pin so Unit/Rate go back to "—" until
    // the user narrows further.
    return { ...patch, hardwareItemId: "" };
  };

  const handleCategoryChange = (categoryId: string) => {
    const patch: Partial<UnitTypeHardware> = { categoryId };
    // Drop brand/description if they no longer belong to this category.
    if (value.brandId && !hardwareItems.some((h) => h.categoryId === categoryId && h.brandId === value.brandId)) {
      patch.brandId = "";
    }
    if (
      value.description &&
      !hardwareItems.some((h) => h.categoryId === categoryId && h.description === value.description)
    ) {
      patch.description = "";
    }
    commit("Category", resolveFromCombo(patch, value));
  };

  const handleBrandChange = (brandId: string) => {
    const patch: Partial<UnitTypeHardware> = { brandId };
    if (
      value.description &&
      !hardwareItems.some(
        (h) =>
          h.brandId === brandId &&
          (!value.categoryId || h.categoryId === value.categoryId) &&
          h.description === value.description
      )
    ) {
      patch.description = "";
    }
    commit("Brand", resolveFromCombo(patch, value));
  };

  const handleDescriptionChange = (description: string) => {
    commit("Description", resolveFromCombo({ description }, value));
  };

  const handleArticleNoChange = (articleNo: string) => {
    const patch: Partial<UnitTypeHardware> = { articleNo };
    if (articleNo) {
      const match = hardwareItems.find((h) => h.articleNo === articleNo);
      if (match) {
        patch.hardwareItemId = match.id;
        patch.categoryId = match.categoryId;
        patch.brandId = match.brandId;
        patch.description = match.description;
        if (!value.levelTypeId && match.levelTypeId) patch.levelTypeId = match.levelTypeId;
      } else {
        // Typed a free-form article no. that doesn't match any HPL SKU.
        patch.hardwareItemId = "";
      }
    }
    onChange(patch);
  };
  // qtyFormula is a raw formula ("H/450") in the Unit Type builder but a
  // resolved plain number once Auto Populate runs it against a real unit —
  // only compute Amount once it's a concrete number. Manual rateOverride
  // wins over the price-list rate — same rule quote-pricing.ts's
  // effectiveHardwareRate applies for group/quote totals.
  const resolvedQty = Number(value.qtyFormula);
  const priceListRate = matched ? rateAfterDiscount(matched) : undefined;
  const effectiveRate = value.rateOverride ?? priceListRate;
  const amount = effectiveRate !== undefined && Number.isFinite(resolvedQty) ? effectiveRate * resolvedQty : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-lg border border-grey-100 bg-card p-3", isDragging && "opacity-50")}
    >
      <div className={cn("flex items-center gap-2", !collapsed && "mb-3")}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-grey-300 hover:text-grey-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand" : "Collapse"}
            className="text-grey-400 hover:text-grey-700"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
        <span className="text-xs font-body font-medium uppercase tracking-wide text-grey-400">Hardware</span>
        {collapsed && (
          <span className="truncate text-sm font-body text-grey-600">
            {value.description || value.articleNo || ""}
            {amount !== undefined && (
              <span className="ml-2 font-number font-semibold text-grey-900">₹{amount.toFixed(2)}</span>
            )}
          </span>
        )}
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy hardware"
            className="ml-auto rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-primary"
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          aria-label="Remove hardware"
          className={`${onCopy ? "" : "ml-auto "}rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!collapsed && (
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 [&>div]:min-w-0">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`hw-art-${value.id}`}>Article No.</Label>
          <Input
            id={`hw-art-${value.id}`}
            placeholder="e.g. BLM-CLIP-110"
            value={value.articleNo ?? ""}
            onChange={(e) => handleArticleNoChange(e.target.value)}
            className="bg-[#F0E4E4]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Category</Label>
          <MaterialReferenceSelect
            category="category"
            value={value.categoryId}
            onChange={handleCategoryChange}
            triggerClassName="bg-[#F0E4E4]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`hw-brand-${value.id}`}>Brand</Label>
          <select
            id={`hw-brand-${value.id}`}
            value={value.brandId ?? ""}
            onChange={(e) => handleBrandChange(e.target.value)}
            className="w-full rounded-lg border border-grey-100 bg-[#F0E4E4] px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
          >
            <option value="">Select brand</option>
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-3">
          <Label htmlFor={`hw-desc-${value.id}`}>Description</Label>
          <select
            id={`hw-desc-${value.id}`}
            value={value.description ?? ""}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            className="w-full rounded-lg border border-grey-100 bg-[#F0E4E4] px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
          >
            <option value="">Select description</option>
            {descriptionOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 lg:col-start-1">
          <Label>Level Type</Label>
          <MaterialReferenceSelect
            category="level-type"
            value={value.levelTypeId ?? ""}
            onChange={(id) => commit("Level Type", { levelTypeId: id })}
            triggerClassName="bg-[#F0E4E4]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`hw-qty-${value.id}`}>Qty</Label>
          <Input
            id={`hw-qty-${value.id}`}
            placeholder="e.g. 2 or H/450"
            value={value.qtyFormula}
            onChange={(e) => onChange({ qtyFormula: e.target.value })}
            className="font-number bg-[#F0E4E4]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Unit</Label>
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-[#F0E4E4] px-3 text-sm font-body text-grey-700">
            {matched ? unitName(matched.unitId) : "—"}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Rate</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-grey-400">₹</span>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="0.00"
              value={value.rateOverride ?? (priceListRate !== undefined ? priceListRate.toFixed(2) : "")}
              readOnly={rateReadOnly}
              onChange={(e) => {
                if (rateReadOnly) return;
                const raw = e.target.value;
                onChange({ rateOverride: raw === "" ? undefined : Number(raw) });
              }}
              className={`pl-5 font-number bg-[#F0E4E4] ${rateReadOnly ? "cursor-not-allowed" : ""}`}
            />
          </div>
          {!rateReadOnly && value.rateOverride !== undefined && priceListRate !== undefined && value.rateOverride !== priceListRate && (
            <button
              type="button"
              onClick={() => onChange({ rateOverride: undefined })}
              className="w-fit text-xs font-body text-primary hover:underline"
            >
              Reset (<span className="font-number">₹{priceListRate.toFixed(2)}</span>)
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <Label>Amount</Label>
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-[#F0E4E4] px-3 text-sm font-number font-semibold text-grey-900">
            {amount !== undefined ? `₹${amount.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove this hardware?"
        description="This removes the line item and its pricing from the quote."
        onConfirm={onRemove}
      />

      <ConfirmDialog
        open={pendingChange !== null}
        onOpenChange={(open) => !open && setPendingChange(null)}
        title={`Change ${pendingChange?.label ?? ""}?`}
        description={`Are you sure you want to change the ${pendingChange?.label?.toLowerCase() ?? ""} for this hardware line? This updates its Rate and Amount.`}
        confirmLabel="Change"
        onConfirm={() => {
          if (pendingChange) onChange(pendingChange.patch);
        }}
      />
    </div>
  );
}
