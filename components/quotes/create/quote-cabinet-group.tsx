"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Check, ChevronDown, ChevronRight, Copy, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { FurnitureLineItemRow, FurnitureTableHeader } from "@/components/templates/furniture-line-item-row";
import { UnitTypeHardwareRow, HardwareTableHeader } from "@/components/templates/unit-type-hardware-row";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { groupTotal, groupSqFt, hardwareLineTotal, evaluateFormula, SQMM_PER_SQFT, resolveLineItemDimensions, carcassUnitFor } from "@/lib/quote-pricing";
import type { QuoteCabinet } from "@/lib/mock/quote";
import type { FurnitureLineItem, UnitTypeHardware } from "@/lib/mock/unit-type";
import { cn } from "@/lib/utils";

export function blankLineItem(): FurnitureLineItem {
  return {
    id: `qli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    isExtra: true,
    widthFormula: "",
    heightFormula: "",
    thicknessId: "",
    rawMaterialTypeId: "",
    internalColourId: "",
    externalColourId: "",
    qty: 1,
  };
}

function blankHardware(): UnitTypeHardware {
  return { id: `qhw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, categoryId: "", hardwareItemId: "", qtyFormula: "1" };
}

function duplicateAt<T extends { id: string }>(items: T[], id: string, makeId: () => string): T[] {
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return items;
  const copy = { ...items[idx], id: makeId() };
  const next = [...items];
  next.splice(idx + 1, 0, copy);
  return next;
}

// One accent per group so a scanning eye can immediately tell Carcass from
// Shutter from Other Panel without reading the header.
// Each colour can be changed in Templates > Colour Palette (--sec-* variables); the fallbacks are the built-in colours.
const groupAccent = {
  primary: { border: "border-l-[color:var(--sec-carcass-edge,var(--primary))]", header: "bg-[var(--sec-carcass,#E0ECD4)]" },
  teal: { border: "border-l-[color:var(--sec-shutter-edge,var(--color-teal))]", header: "bg-[var(--sec-shutter,var(--color-teal-transparent))]" },
  warning: { border: "border-l-[color:var(--sec-other-panel-edge,var(--color-warning))]", header: "bg-[var(--sec-other-panel,var(--color-warning-transparent))]" },
  info: { border: "border-l-[color:var(--sec-hardware-edge,var(--color-info))]", header: "bg-[var(--sec-hardware,rgb(255_213_153/0.5))]" },
} as const;

export function FurnitureGroup({
  title,
  label,
  showComponentName,
  showLevelType,
  items,
  unit,
  onChange,
  addLabel,
  accent = "primary",
  hideWhenEmpty,
  defaultOpen,
}: {
  title: string;
  label: string;
  showComponentName: boolean;
  showLevelType?: boolean;
  items: FurnitureLineItem[];
  unit: { width: number; depth: number; height: number; qty: number };
  onChange: (items: FurnitureLineItem[]) => void;
  addLabel: string;
  accent?: keyof typeof groupAccent;
  hideWhenEmpty?: boolean;
  // Starts opened (the Shutter / Hardware filter views); otherwise a group starts closed.
  defaultOpen?: boolean;
}) {
  const furnitureItems = useFurniturePriceItems();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const subtotal = groupTotal(items, unit, furnitureItems);
  const totalSqFt = groupSqFt(items, unit);
  const isViewMode = useSearchParams().get("mode") === "view";
  const [collapsed, setCollapsed] = useState(!defaultOpen);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  };

  if (hideWhenEmpty && items.length === 0) return null;

  const a = groupAccent[accent];
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border-l-4 bg-light-600 p-3", a.border)}>
      <div className={cn("-mx-3 -mt-3 flex items-center justify-between rounded-t-md px-3 py-1", a.header)}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-grey-400 hover:bg-card hover:text-grey-700"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <h4 className="text-xs font-body font-semibold uppercase tracking-wide text-grey-700">{title}</h4>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-number text-grey-500">{totalSqFt.toFixed(2)} sq.ft</span>
          <span className="text-sm font-number font-semibold text-grey-700">₹{subtotal.toFixed(2)}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...items, blankLineItem()])}
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        </div>
      </div>

      {!collapsed && items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="overflow-x-auto rounded-md border border-grey-100 bg-card">
             <div className={showLevelType ? "min-w-[1130px]" : "min-w-[1020px]"}>
              <FurnitureTableHeader showComponentName={showComponentName} showLevelType={!!showLevelType} nameLabel={label} />
              {items.map((item) => {
                const w = evaluateFormula(item.widthFormula, { W: unit.width, D: unit.depth, H: unit.height });
                const h = evaluateFormula(item.heightFormula, { W: unit.width, D: unit.depth, H: unit.height });
                const totalSqFt = ((w * h) / SQMM_PER_SQFT) * item.qty;
                return (
                  <FurnitureLineItemRow
                    key={item.id}
                    value={item}
                    label={label}
                    showComponentName={showComponentName}
                    showLevelType={showLevelType}
                    table
                    totalSqFt={totalSqFt}
                    unitDims={{ W: unit.width, D: unit.depth, H: unit.height }}

                    onChange={(patch) => onChange(items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))}
                    onRemove={() => onChange(items.filter((i) => i.id !== item.id))}
                    onCopy={() => onChange(duplicateAt(items, item.id, () => `qli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`))}
                  />
                );
              })}
             </div>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

export function HardwareGroup({
  items,
  unit,
  onChange,
  hideWhenEmpty,
  defaultOpen,
}: {
  items: UnitTypeHardware[];
  unit: { width: number; depth: number; height: number; qty: number };
  onChange: (items: UnitTypeHardware[]) => void;
  hideWhenEmpty?: boolean;
  defaultOpen?: boolean;
}) {
  const hardwareItems = useHardwarePriceItems();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const total = items.reduce((sum, h) => sum + hardwareLineTotal(h, unit, hardwareItems), 0);
  const isViewMode = useSearchParams().get("mode") === "view";
  const [collapsed, setCollapsed] = useState(!defaultOpen);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  };

  if (hideWhenEmpty && items.length === 0) return null;

  const a = groupAccent.info;
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border-l-4 bg-light-600 p-3", a.border)}>
      <div className={cn("-mx-3 -mt-3 flex items-center justify-between rounded-t-md px-3 py-1", a.header)}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={collapsed ? "Expand Hardware" : "Collapse Hardware"}
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-grey-400 hover:bg-card hover:text-grey-700"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <h4 className="text-xs font-body font-semibold uppercase tracking-wide text-grey-700">Hardware</h4>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-number font-semibold text-grey-700">₹{total.toFixed(2)}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, blankHardware()])}>
            <Plus className="h-3.5 w-3.5" />
            Add Hardware
          </Button>
        </div>
      </div>

      {!collapsed && items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="overflow-x-auto rounded-md border border-grey-100 bg-card">
             <div className="min-w-[1000px]">
              <HardwareTableHeader />
              {items.map((item) => (
                <UnitTypeHardwareRow
                  key={item.id}
                  table
                  value={item}
                  onChange={(patch) => onChange(items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))}
                  onRemove={() => onChange(items.filter((i) => i.id !== item.id))}
                  onCopy={() => onChange(duplicateAt(items, item.id, () => `qhw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`))}
                />
              ))}
             </div>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// Auto Populate: a cabinet type's carcass components, sized for the cabinet's carcass (its own W/D/H/Qty, else the unit's).
export const autoPopulateComponents = (type: { components: FurnitureLineItem[] }, carcassUnit: { width: number; depth: number; height: number; qty: number }) =>
  type.components.map((c) => resolveLineItemDimensions({ ...c, id: `qli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }, carcassUnit));

// compact: the smaller trigger used in table rows (the Carcass tab).
export function CabinetTypeSelect({ value, onChange, compact = false }: { value: string; onChange: (id: string) => void; compact?: boolean }) {
  const cabinetTypes = useCabinetTypes();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = cabinetTypes.find((c) => c.id === value);
  const results = cabinetTypes
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn("flex w-full items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card font-body font-semibold text-grey-800 outline-none focus:border-primary", compact ? "h-6 min-w-0 px-2 text-xs" : "min-w-32 px-3 py-1.5 text-sm")}>
        {selected ? <span className="truncate">{selected.name}</span> : <span className="truncate text-grey-400 font-normal">Select Cabinet Type</span>}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] p-2">
        <Input autoFocus placeholder="Search cabinet types" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2" />
        <div className="flex max-h-52 flex-col overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.id);
                setOpen(false);
                setQuery("");
              }}
              className={cn(
                "flex w-full min-w-0 items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600",
                c.id === value ? "text-primary" : "text-grey-800"
              )}
            >
              <span className="min-w-0 break-words">{c.name}</span>
              {c.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
          {results.length === 0 && <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function QuoteCabinetGroup({
  cabinet,
  index,
  unit,
  total,
  onChange,
  onRemove,
  onDuplicate,
  onAddCabinet,
}: {
  cabinet: QuoteCabinet;
  index: string;
  unit: { width: number; depth: number; height: number; qty: number };
  total: number;
  onChange: (patch: Partial<QuoteCabinet>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onAddCabinet?: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isViewMode = useSearchParams().get("mode") === "view";
  const [collapsed, setCollapsed] = useState(isViewMode);
  const cabinetTypes = useCabinetTypes();
  const selectedCabinetType = cabinetTypes.find((c) => c.id === cabinet.cabinetTypeId);
  const carcassUnit = carcassUnitFor(cabinet, unit);

  const runAutoPopulate = () => {
    if (!selectedCabinetType) return;
    onChange({ components: autoPopulateComponents(selectedCabinetType, carcassUnit) });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-grey-100 bg-card p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={collapsed ? "Expand cabinet" : "Collapse cabinet"}
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-grey-100 bg-light-600 text-grey-500 hover:text-grey-800"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span className="shrink-0 text-xs font-body font-medium text-grey-400">
          <span className="font-number">{index}</span>. Type:
        </span>
        <div className="min-w-32 max-w-72 flex-1">
          <CabinetTypeSelect
            value={cabinet.cabinetTypeId}
            onChange={(cabinetTypeId) => onChange({ cabinetTypeId })}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["W", "D", "H"] as const).map((dim) => {
            const key = dim === "W" ? "carcassWidth" : dim === "D" ? "carcassDepth" : "carcassHeight";
            const fallback = dim === "W" ? unit.width : dim === "D" ? unit.depth : unit.height;
            return (
              <div key={dim} className="flex items-center gap-1">
                <span className="text-xs font-body text-grey-500">{dim}</span>
                <Input
                  type="number"
                  value={cabinet[key] ?? fallback ?? ""}
                  onChange={(e) => onChange({ [key]: Number(e.target.value) })}
                  className="h-7 w-16 bg-card text-sm font-number [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            );
          })}
          <div className="flex items-center gap-1">
            <span className="text-xs font-body text-grey-500">Qty</span>
            <Input
              type="number"
              min={1}
              value={cabinet.carcassQty ?? unit.qty ?? ""}
              onChange={(e) => onChange({ carcassQty: Number(e.target.value) })}
              className="h-7 w-14 bg-card text-sm font-number [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
        <Button type="button" size="icon-sm" aria-label="Auto Populate" title="Auto Populate" disabled={!selectedCabinetType} onClick={runAutoPopulate}>
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
        {cabinet.externalFinishes.length === 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ externalFinishes: [blankLineItem()] })}>
            <Plus className="h-3.5 w-3.5" />
            Shutter
          </Button>
        )}
        {cabinet.panels.length === 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ panels: [blankLineItem()] })}>
            <Plus className="h-3.5 w-3.5" />
            Other Panel
          </Button>
        )}
        {cabinet.hardware.length === 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ hardware: [blankHardware()] })}>
            <Plus className="h-3.5 w-3.5" />
            Hardware
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onAddCabinet && (
            <Button type="button" size="sm" variant="outline" onClick={onAddCabinet}>
              <Plus className="h-3.5 w-3.5" />
              Add Cabinet
            </Button>
          )}
          <span className="text-sm font-body font-semibold text-grey-900">Cabinet Total: <span className="font-number">₹{total.toFixed(2)}</span></span>
          <button
            type="button"
            aria-label="Duplicate cabinet"
            title="Duplicate this cabinet"
            onClick={onDuplicate}
            className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-grey-700"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Remove cabinet"
            onClick={() => setDeleteOpen(true)}
            className="rounded-md p-1.5 text-grey-400 hover:bg-error-transparent hover:text-error"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <FurnitureGroup
            title="Carcass"
            label="Component"
            showComponentName
            accent="primary"
            items={cabinet.components}
            unit={carcassUnit}
            addLabel="Add Component"
            onChange={(components) => onChange({ components })}

          />
          <FurnitureGroup
            title="Shutter"
            label="External Finish"
            showComponentName
            accent="teal"
            items={cabinet.externalFinishes}
            unit={unit}
            addLabel="Add Shutter"
            onChange={(externalFinishes) => onChange({ externalFinishes })}
            hideWhenEmpty

          />
          <FurnitureGroup
            title="Other Panel"
            label="Other Panel"
            showComponentName
            showLevelType
            accent="warning"
            items={cabinet.panels}
            unit={unit}
            addLabel="Other Panel"
            onChange={(panels) => onChange({ panels })}
            hideWhenEmpty

          />
          <HardwareGroup
            items={cabinet.hardware}
            unit={unit}
            onChange={(hardware) => onChange({ hardware })}
            hideWhenEmpty

          />
        </>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this cabinet?"
        description="This removes the cabinet and all its Carcass, Shutter, and Hardware line items from the quote."
        onConfirm={onRemove}
      />
    </div>
  );
}
