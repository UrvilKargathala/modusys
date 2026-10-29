"use client";

import { evaluateFormula } from "@/lib/quote-pricing";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Copy, CopyPlus, Trash2, AlertTriangle, Plus, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { FurniturePriceFormDialog } from "@/components/templates/furniture-price-form-dialog";
import { useFinishColours } from "@/components/templates/finish-colours";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useFurniturePriceItems, pricingListStore } from "@/lib/store/pricing-list-store";
import { cn } from "@/lib/utils";
import { useSentPo } from "@/components/shared/sent-lines-context";
import { SortLabel, type LineSort } from "@/components/templates/line-sort";
import type { FurnitureLineItem } from "@/lib/mock/unit-type";

// True on the New Quote page (not when editing a saved quote): a component row's Rate then follows the price list for its
// current combination, shown directly in the Rate box, until the user types a rate of their own.
export const FollowPriceListContext = createContext(false);

const materialFieldLabel: Record<string, string> = {
  componentTypeId: "Component Name",
  thicknessId: "Thickness",
  rawMaterialTypeId: "Raw Material",
  internalColourId: "Internal Colour",
  externalColourId: "External Colour",
};


// Column widths for the table layout (Quotes' cabinet groups): drag, [name], W, H, Qty, Thickness, sq.ft, Raw, External, Internal,
// Rate, Amount, [Level Type], actions. The group's header row uses the same string so the columns line up.
export function furnitureTableColumns(showComponentName: boolean, showLevelType: boolean, withNo = false) {
  return [
    withNo ? "44px" : "20px",
    showComponentName && "minmax(110px,1.1fr)",
    "56px", "56px", "40px", "72px", "52px",
    "minmax(100px,1fr)", "minmax(100px,1fr)", "minmax(100px,1fr)",
    "76px", "84px",
    showLevelType && "100px",
    "76px",
  ].filter(Boolean).join(" ");
}

export function FurnitureTableHeader({ showComponentName, showLevelType, nameLabel, withNo = false, sort, onSort }: { showComponentName: boolean; showLevelType: boolean; nameLabel: string; withNo?: boolean; sort?: LineSort; onSort?: (key: string) => void }) {
  const heads: [string, string?][] = [[withNo ? "No." : "", "no"]];
  if (showComponentName) heads.push([nameLabel, "name"]);
  heads.push(["Width", "width"], ["Height", "height"], ["Qty", "qty"], ["Thk", "thk"], ["Sq.ft", "sqft"], ["Raw Material", "raw"], ["External Colour", "external"], ["Internal Colour", "internal"], ["Rate", "rate"], ["Amount", "amount"]);
  if (showLevelType) heads.push(["Level Type", "level"]);
  heads.push(["", undefined]);
  return (
    <div className="table-head grid items-center gap-x-1.5 border-b border-grey-100 bg-[var(--table-head)] px-2 py-1 text-xs font-medium text-grey-900" style={{ gridTemplateColumns: furnitureTableColumns(showComponentName, showLevelType, withNo) }}>
      {heads.map(([h, k], i) => (
        <span key={i} className={["Width", "Height", "Qty", "Sq.ft"].includes(h) ? "text-center" : ["Amount", "Rate"].includes(h) ? "text-right" : ""}>
          <SortLabel label={h} k={k} sort={sort} onSort={onSort} />
        </span>
      ))}
    </div>
  );
}

// Shared by Unit Type's Components and External Finish tabs (and could
// replace Cabinet Type's near-identical row too) — same four-way material
// combination drives the same Furniture Price List lookup either way.
// `showComponentName` toggles the Furniture Component picker, the one field
// that's meaningful for Components but not External Finish.
export function FurnitureLineItemRow({
  value,
  onChange,
  onRemove,
  onCopy,
  onCopyBlank,
  label,
  showComponentName,
  showLevelType,
  totalSqFt,
  compact,
  rateReadOnly,
  collapsible,
  unitDims,
  table,
  rowNo,
}: {
  value: FurnitureLineItem;
  onChange: (patch: Partial<FurnitureLineItem>) => void;
  onRemove: () => void;
  onCopy?: () => void;
  // A second copy button: the same row with Thickness, Raw Material and the colours left empty.
  onCopyBlank?: () => void;
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
  // Quotes-only — when set, typing a formula like "w-10" collapses to the
  // concrete number (on blur/tab) for this Unit's dimensions.
  unitDims?: { W: number; D: number; H: number };
  compact?: boolean;
  // Templates want Rate locked to the Price List — edits happen there, not
  // here. Quotes keep it editable so users can override per line.
  rateReadOnly?: boolean;
  // Templates' Unit Type builder only — Quotes keeps every row always
  // expanded since users are actively pricing there.
  collapsible?: boolean;
  // Quotes' cabinet groups: one compact table line per row (columns from furnitureTableColumns) instead of the card form.
  table?: boolean;
  // Table layout only: a row number (1.1, 1.2 ...) shown in place of the drag handle.
  rowNo?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: value.id });
  // On a Purchase Order already (Requirement Order editor): locked.
  const sentPo = useSentPo(value.id);
  // Internal / External Colour are picked from Finish Material, like the Furniture Price List (see useFinishColours).
  const { nameOfColour, finishIdOf, colourIdFor } = useFinishColours();
  const colourPick = (list: "internal-colour" | "external-colour", field: "internalColourId" | "externalColourId") => ({
    category: "finish-material" as const,
    value: finishIdOf(list, value[field]),
    fallbackText: nameOfColour(list, value[field]) || undefined,
    onChange: (id: string) => requestMaterialChange(field, colourIdFor(list, id)),
  });
  const [addPriceOpen, setAddPriceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingMaterialChange, setPendingMaterialChange] = useState<{ field: string; id: string } | null>(null);
  const [collapsed, setCollapsed] = useState(!!collapsible);

  const furnitureItems = useFurniturePriceItems();
  const followPriceList = useContext(FollowPriceListContext);
  const [typedRate, setTypedRate] = useState(false);
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

  // Quotes only: collapse a W/D/H formula ("w-10") to its number on blur.
  // Invalid or non-positive results keep what was typed rather than wiping it.
  const resolveOnBlur = (field: "widthFormula" | "heightFormula") => {
    if (!unitDims || !/[WDH]/i.test(value[field])) return;
    const n = Math.round(evaluateFormula(value[field], unitDims));
    if (n > 0) handleFieldChange({ [field]: String(n) });
  };

  // Thickness/Raw Material/Internal/External Colour drive the price-list
  // lookup — changing any of them changes Rate/Amount, so confirm before
  // applying rather than silently reprice the row.
  const requestMaterialChange = (field: string, id: string) => {
    const current = value[field as keyof FurnitureLineItem];
    if (current) {
      setPendingMaterialChange({ field, id });
    } else {
      handleFieldChange({ [field]: id });
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

  // Manual override wins — same rule quote-pricing.ts's effectiveFurnitureRate
  // applies for Amount/subtotal/quote-total math, kept in sync here so the
  // row's own display never disagrees with those totals.
  const useListRate = followPriceList && !typedRate && !!match;
  const canReset = !rateReadOnly && !followPriceList && value.rateOverride !== undefined && !!match && value.rateOverride !== match.rate;
  const effectiveRate = useListRate ? match!.rate : (value.rateOverride ?? match?.rate);

  // New Quote: keep the saved rate (used for Amount and totals) equal to the price-list rate, so nothing is left to reset.
  useEffect(() => {
    if (useListRate && value.rateOverride !== match!.rate) onChange({ rateOverride: match!.rate });
  }, [useListRate, match, value.rateOverride, onChange]);

  const dialogs = (
    <>
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
    </>
  );

  if (table) {
    const priceWarning = combinationComplete && !match && (
      <div className="mt-0.5 flex flex-wrap items-center gap-2 rounded-md bg-warning-transparent px-2 py-1 text-xs font-body text-warning">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        No price found for this combination.
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAddPriceOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add this combination to Furniture Price List
        </Button>
      </div>
    );
    const iconBtn = "rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-primary";
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={cn("unit-row border-b border-grey-100 bg-card px-2 py-0.5 last:border-b-0", isDragging && "opacity-50", sentPo && "bg-success-transparent")}
      >
        <fieldset disabled={!!sentPo} className="m-0 min-w-0 border-0 p-0">
        <div className="grid items-center gap-x-1.5" style={{ gridTemplateColumns: furnitureTableColumns(!!showComponentName, !!showLevelType, !!rowNo) }}>
          {rowNo ? (
            <span className="num text-xs font-semibold text-grey-700">{rowNo}</span>
          ) : (
            <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none text-grey-300 hover:text-grey-500 active:cursor-grabbing" aria-label="Drag to reorder">
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          {showComponentName && (
            <MaterialReferenceSelect category="furniture-component" wide sorted value={value.componentTypeId ?? ""} onChange={(id) => requestMaterialChange("componentTypeId", id)} />
          )}
          <Input aria-label="Width" placeholder="W" value={value.widthFormula} onChange={(e) => handleFieldChange({ widthFormula: e.target.value })} onBlur={() => resolveOnBlur("widthFormula")} className="num px-1 text-center" />
          <Input aria-label="Height" placeholder="H" value={value.heightFormula} onChange={(e) => handleFieldChange({ heightFormula: e.target.value })} onBlur={() => resolveOnBlur("heightFormula")} className="num px-1 text-center" />
          <Input aria-label="Qty" type="number" min={1} value={value.qty || ""} onChange={(e) => handleFieldChange({ qty: Number(e.target.value) })} className="num px-1 text-center" />
          <MaterialReferenceSelect category="thickness" value={value.thicknessId} onChange={(id) => requestMaterialChange("thicknessId", id)} triggerClassName="gap-1 px-1.5 font-number" />
          <span className="num text-center text-sm text-grey-700">{totalSqFt !== undefined ? totalSqFt.toFixed(2) : "—"}</span>
          <MaterialReferenceSelect category="raw-material-type" wide sorted value={value.rawMaterialTypeId} onChange={(id) => requestMaterialChange("rawMaterialTypeId", id)} />
          <MaterialReferenceSelect {...colourPick("external-colour", "externalColourId")} wide sorted />
          <MaterialReferenceSelect {...colourPick("internal-colour", "internalColourId")} wide sorted />
          <Input
            aria-label="Rate per sq.ft"
            type="number"
            step="0.01"
            min={0}
            placeholder="0.00"
            value={useListRate ? match!.rate.toFixed(2) : (value.rateOverride !== undefined ? Math.round(value.rateOverride * 100) / 100 : (match ? match.rate.toFixed(2) : ""))}
            readOnly={rateReadOnly}
            onChange={(e) => {
              if (rateReadOnly) return;
              setTypedRate(true);
              const raw = e.target.value;
              handleFieldChange({ rateOverride: raw === "" ? undefined : Number(raw) });
            }}
            className={cn("num px-1 text-right", rateReadOnly && "cursor-not-allowed")}
          />
          <span className="num text-right text-sm font-semibold text-grey-900">
            {totalSqFt !== undefined ? `₹${(effectiveRate !== undefined ? effectiveRate * totalSqFt : 0).toFixed(2)}` : "—"}
          </span>
          {showLevelType && (
            <MaterialReferenceSelect category="level-type" value={value.levelTypeId ?? ""} onChange={(id) => handleFieldChange({ levelTypeId: id })} />
          )}
          <div className="flex items-center justify-end">
            {canReset && (
              <button type="button" title={`Reset to the price-list rate ₹${match!.rate.toFixed(2)}`} onClick={() => handleFieldChange({ rateOverride: undefined })} className={cn(iconBtn, "text-primary")}>
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            {onCopy && (
              <button type="button" onClick={onCopy} aria-label={`Copy ${label.toLowerCase()}`} className={iconBtn}>
                <Copy className="h-4 w-4" />
              </button>
            )}
            {onCopy && onCopyBlank && (
              <button type="button" onClick={onCopyBlank} aria-label={`Copy ${label.toLowerCase()} without material and colours`} title="Copy without Thickness, Raw Material and colours" className={iconBtn}>
                <CopyPlus className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={() => setDeleteOpen(true)} aria-label={`Remove ${label.toLowerCase()}`} className="rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        </fieldset>
        {sentPo && <p className="pb-0.5 text-[11px] font-body font-medium text-success">On {sentPo} · locked (take it off that PO to change it)</p>}
        {priceWarning}
        {dialogs}
      </div>
    );
  }

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
        <span className="text-xs font-body font-medium uppercase tracking-wide text-grey-400">{label}</span>
        {collapsed && (
          <span className="truncate text-sm font-body text-grey-600">
            {value.widthFormula || value.heightFormula ? `${value.widthFormula || "—"} × ${value.heightFormula || "—"}` : ""}
            {totalSqFt !== undefined && (
              <span className="ml-2 font-number font-semibold text-grey-900">
                ₹{(effectiveRate !== undefined ? effectiveRate * totalSqFt : 0).toFixed(2)}
              </span>
            )}
          </span>
        )}
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
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy ${label.toLowerCase()}`}
            className="ml-auto rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-primary"
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
        {onCopy && onCopyBlank && (
          <button
            type="button"
            onClick={onCopyBlank}
            aria-label={`Copy ${label.toLowerCase()} without material and colours`}
            title="Copy without Thickness, Raw Material and colours"
            className="rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-primary"
          >
            <CopyPlus className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          aria-label={`Remove ${label.toLowerCase()}`}
          className={cn(onCopy ? "" : "ml-auto", "rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {!collapsed && (<>
      <div className={cn("grid gap-x-3 gap-y-3 [&>div]:min-w-0", compact ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6")}>
        {showComponentName && (
          <div className="flex flex-col gap-1.5">
            <Label className="whitespace-nowrap">Component Name</Label>
            <MaterialReferenceSelect
              category="furniture-component"
              wide
              sorted
              value={value.componentTypeId ?? ""}
              onChange={(id) => requestMaterialChange("componentTypeId", id)}
              triggerClassName="bg-[var(--input-bg,#EAF7FC)]"
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5" data-narrow="md">
          <Label htmlFor={`w-${value.id}`}>Width</Label>
          <Input
            id={`w-${value.id}`}
            placeholder="e.g. (W-95)/2"
            value={value.widthFormula}
            onChange={(e) => handleFieldChange({ widthFormula: e.target.value })}
            onBlur={() => resolveOnBlur("widthFormula")}
            className="font-number bg-[var(--input-bg,#EAF7FC)]"
          />
        </div>
        <div className="flex flex-col gap-1.5" data-narrow="md">
          <Label htmlFor={`h-${value.id}`}>Height</Label>
          <Input
            id={`h-${value.id}`}
            placeholder="e.g. H-20"
            value={value.heightFormula}
            onChange={(e) => handleFieldChange({ heightFormula: e.target.value })}
            onBlur={() => resolveOnBlur("heightFormula")}
            className="font-number bg-[var(--input-bg,#EAF7FC)]"
          />
        </div>
        <div className="flex flex-col gap-1.5" data-narrow="xs">
          <Label htmlFor={`qty-${value.id}`}>Qty</Label>
          <Input
            id={`qty-${value.id}`}
            type="number"
            min={1}
            className="font-number bg-[var(--input-bg,#EAF7FC)]"
            value={value.qty || ""}
            onChange={(e) => handleFieldChange({ qty: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5" data-narrow="sm">
          <Label>Thickness</Label>
          <MaterialReferenceSelect
            category="thickness"
            value={value.thicknessId}
            onChange={(id) => requestMaterialChange("thicknessId", id)}
            triggerClassName="font-number bg-[var(--input-bg,#EAF7FC)]"
          />
        </div>
        {totalSqFt !== undefined && (
          <div className="flex flex-col gap-1.5" data-narrow="sm">
            <Label>Total sq.ft</Label>
            <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-[var(--input-bg,#EAF7FC)] px-3 text-sm font-number font-semibold text-grey-700">
              {totalSqFt.toFixed(2)}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label>Raw Material</Label>
          <MaterialReferenceSelect
            category="raw-material-type"
            wide
            sorted
            value={value.rawMaterialTypeId}
            onChange={(id) => requestMaterialChange("rawMaterialTypeId", id)}
            triggerClassName="bg-[var(--input-bg,#EAF7FC)]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>External Colour</Label>
          <MaterialReferenceSelect
            {...colourPick("external-colour", "externalColourId")}
            wide
            sorted
            triggerClassName="bg-[var(--input-bg,#EAF7FC)]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Internal Colour</Label>
          <MaterialReferenceSelect
            {...colourPick("internal-colour", "internalColourId")}
            wide
            sorted
            triggerClassName="bg-[var(--input-bg,#EAF7FC)]"
          />
        </div>
        <div className="flex flex-col gap-1.5" data-narrow="md">
          <Label>Amount</Label>
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-[var(--input-bg,#EAF7FC)] px-3 text-sm font-number font-semibold text-grey-900">
            {totalSqFt !== undefined
              ? `₹${(effectiveRate !== undefined ? effectiveRate * totalSqFt : 0).toFixed(2)}`
              : "—"}
          </div>
        </div>
        <div className="flex flex-col gap-1.5" data-narrow="rate">
          <Label>Rate</Label>
          <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="0.00"
              value={useListRate ? match!.rate.toFixed(2) : (value.rateOverride !== undefined ? Math.round(value.rateOverride * 100) / 100 : (match ? match.rate.toFixed(2) : ""))}
              readOnly={rateReadOnly}
              onChange={(e) => {
                if (rateReadOnly) return;
                setTypedRate(true);
                const raw = e.target.value;
                handleFieldChange({ rateOverride: raw === "" ? undefined : Number(raw) });
              }}
              className={`pr-14 font-number bg-[var(--input-bg,#EAF7FC)] ${rateReadOnly ? "cursor-not-allowed" : ""}`}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-grey-400">/sq.ft</span>
          </div>
          {/* Typed over the price-list rate: a box beside the rate shows the price-list rate; click it to put that rate back. */}
          {canReset && (
            <button
              type="button"
              title="Reset to the price-list rate"
              onClick={() => handleFieldChange({ rateOverride: undefined })}
              className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary bg-primary-transparent px-2.5 text-xs font-body font-medium text-primary hover:bg-primary hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset <span className="font-number">₹{match!.rate.toFixed(2)}</span>
            </button>
          )}
          </div>
        </div>
        {showLevelType && (
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label>Level Type</Label>
            <MaterialReferenceSelect
              category="level-type"
              value={value.levelTypeId ?? ""}
              onChange={(id) => handleFieldChange({ levelTypeId: id })}
              triggerClassName="bg-[var(--input-bg,#EAF7FC)]"
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
      </>)}

      {dialogs}
    </div>
  );
}
