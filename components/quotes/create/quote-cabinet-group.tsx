"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Check, ChevronDown, ChevronRight, Copy, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { FurnitureLineItemRow } from "@/components/templates/furniture-line-item-row";
import { UnitTypeHardwareRow } from "@/components/templates/unit-type-hardware-row";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { groupTotal, hardwareLineTotal, evaluateFormula, SQMM_PER_SQFT, resolveLineItemDimensions } from "@/lib/quote-pricing";
import type { QuoteCabinet } from "@/lib/mock/quote";
import type { FurnitureLineItem, UnitTypeHardware } from "@/lib/mock/unit-type";
import { cn } from "@/lib/utils";

function blankLineItem(): FurnitureLineItem {
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

export function FurnitureGroup({
  title,
  label,
  showComponentName,
  showLevelType,
  items,
  unit,
  onChange,
  addLabel,
}: {
  title: string;
  label: string;
  showComponentName: boolean;
  showLevelType?: boolean;
  items: FurnitureLineItem[];
  unit: { width: number; depth: number; height: number; qty: number };
  onChange: (items: FurnitureLineItem[]) => void;
  addLabel: string;
}) {
  const furnitureItems = useFurniturePriceItems();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const subtotal = groupTotal(items, unit, furnitureItems);
  const isViewMode = useSearchParams().get("mode") === "view";
  const [collapsed, setCollapsed] = useState(isViewMode);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-light-600 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-grey-400 hover:bg-card hover:text-grey-700"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <h4 className="text-xs font-body font-semibold uppercase tracking-wide text-grey-500">{title}</h4>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-body font-semibold text-grey-700">₹{subtotal.toFixed(2)}</span>
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
            <div className="flex flex-col gap-2">
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
                    totalSqFt={totalSqFt}
                    onChange={(patch) => onChange(items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))}
                    onRemove={() => onChange(items.filter((i) => i.id !== item.id))}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function HardwareGroup({
  items,
  unit,
  onChange,
}: {
  items: UnitTypeHardware[];
  unit: { width: number; depth: number; height: number; qty: number };
  onChange: (items: UnitTypeHardware[]) => void;
}) {
  const hardwareItems = useHardwarePriceItems();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const total = items.reduce((sum, h) => sum + hardwareLineTotal(h, unit, hardwareItems), 0);
  const isViewMode = useSearchParams().get("mode") === "view";
  const [collapsed, setCollapsed] = useState(isViewMode);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-light-600 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={collapsed ? "Expand Hardware" : "Collapse Hardware"}
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-grey-400 hover:bg-card hover:text-grey-700"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <h4 className="text-xs font-body font-semibold uppercase tracking-wide text-grey-500">Hardware</h4>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-body font-semibold text-grey-700">₹{total.toFixed(2)}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, blankHardware()])}>
            <Plus className="h-3.5 w-3.5" />
            Add Hardware
          </Button>
        </div>
      </div>

      {!collapsed && items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <UnitTypeHardwareRow
                  key={item.id}
                  value={item}
                  onChange={(patch) => onChange(items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))}
                  onRemove={() => onChange(items.filter((i) => i.id !== item.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function CabinetTypeSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const cabinetTypes = useCabinetTypes();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = cabinetTypes.find((c) => c.id === value);
  const results = cabinetTypes.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex min-w-56 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-sm font-body font-semibold text-grey-800 outline-none focus:border-primary">
        {selected ? <span className="truncate">{selected.name}</span> : <span className="truncate text-grey-400 font-normal">Select Cabinet Type</span>}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
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
                "flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600",
                c.id === value ? "text-primary" : "text-grey-800"
              )}
            >
              <span className="min-w-0 truncate">{c.name}</span>
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
}: {
  cabinet: QuoteCabinet;
  index: number;
  unit: { width: number; depth: number; height: number; qty: number };
  total: number;
  onChange: (patch: Partial<QuoteCabinet>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isViewMode = useSearchParams().get("mode") === "view";
  const [collapsed, setCollapsed] = useState(isViewMode);
  const cabinetTypes = useCabinetTypes();
  const selectedCabinetType = cabinetTypes.find((c) => c.id === cabinet.cabinetTypeId);

  const runAutoPopulate = () => {
    if (!selectedCabinetType) return;
    onChange({
      components: selectedCabinetType.components.map((c) =>
        resolveLineItemDimensions({ ...c, id: `qli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }, unit)
      ),
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-grey-100 bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-label={collapsed ? "Expand cabinet" : "Collapse cabinet"}
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-grey-100 bg-light-600 text-grey-500 hover:text-grey-800"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span className="shrink-0 text-xs font-body font-medium text-grey-400">
          {index}. Type:
        </span>
        <CabinetTypeSelect
          value={cabinet.cabinetTypeId}
          onChange={(cabinetTypeId) => onChange({ cabinetTypeId })}
        />
        <Button type="button" size="sm" disabled={!selectedCabinetType} onClick={runAutoPopulate}>
          <Sparkles className="h-3.5 w-3.5" />
          Auto Populate
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm font-body font-semibold text-grey-900">Cabinet Total: ₹{total.toFixed(2)}</span>
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
            items={cabinet.components}
            unit={unit}
            addLabel="Add Component"
            onChange={(components) => onChange({ components })}
          />
          <FurnitureGroup
            title="Shutter"
            label="External Finish"
            showComponentName={false}
            items={cabinet.externalFinishes}
            unit={unit}
            addLabel="Add Shutter"
            onChange={(externalFinishes) => onChange({ externalFinishes })}
          />
          <FurnitureGroup
            title="Other Panel"
            label="Other Panel"
            showComponentName={false}
            showLevelType
            items={cabinet.panels}
            unit={unit}
            addLabel="Other Panel"
            onChange={(panels) => onChange({ panels })}
          />
          <HardwareGroup items={cabinet.hardware} unit={unit} onChange={(hardware) => onChange({ hardware })} />
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
