"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, ChevronRight, Copy, GripVertical, Plus, Sparkles, Trash2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { QuoteCabinetGroup } from "@/components/quotes/create/quote-cabinet-group";
import { UnitTypeFormDialog } from "@/components/templates/unit-type-form-dialog";
import { useUnitTypes, unitTypeStore } from "@/lib/store/unit-type-store";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { cabinetTotal, unitTotal, resolveLineItemDimensions, resolveHardwareForUnit, findFurnitureMatch } from "@/lib/quote-pricing";
import type { QuoteUnit, QuoteCabinet } from "@/lib/mock/quote";
import type { UnitType, FurnitureLineItem, UnitTypeHardware } from "@/lib/mock/unit-type";
import { rateAfterDiscount, type FurniturePriceItem, type HardwarePriceItem } from "@/lib/mock/pricing-list";
import { cn } from "@/lib/utils";

function cloneLineItem(item: FurnitureLineItem): FurnitureLineItem {
  return { ...item, id: `qli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
}
// Older Unit Type templates only stored hardwareItemId (no independent
// articleNo/brandId/description/levelTypeId — those fields were added
// later). Backfill them from the matched Hardware Price List item so
// Auto Populate doesn't leave those columns blank for legacy templates.
function cloneHardware(item: UnitTypeHardware, hardwareItems: HardwarePriceItem[]): UnitTypeHardware {
  const clone = { ...item, id: `qhw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  const matched = hardwareItems.find((h) => h.id === item.hardwareItemId);
  if (matched) {
    if (!clone.articleNo) clone.articleNo = matched.articleNo;
    if (!clone.brandId) clone.brandId = matched.brandId;
    if (!clone.description) clone.description = matched.description;
    if (!clone.levelTypeId) clone.levelTypeId = matched.levelTypeId;
  }
  return clone;
}

function buildCabinetsFromUnitType(
  unitType: UnitType,
  cabinetTypeName: (id: string) => string,
  unitDims: { width: number; depth: number; height: number; qty: number },
  hardwareItems: HardwarePriceItem[],
  furnitureItems: FurniturePriceItem[]
): QuoteCabinet[] {
  const resolve = (item: FurnitureLineItem) => {
    const resolved = resolveLineItemDimensions(cloneLineItem(item), unitDims);
    if (resolved.rateOverride === undefined) {
      const match = findFurnitureMatch(item, furnitureItems);
      if (match) resolved.rateOverride = match.rate;
    }
    return resolved;
  };
  const resolveHw = (item: UnitTypeHardware) => {
    const resolved = resolveHardwareForUnit(cloneHardware(item, hardwareItems), unitDims);
    if (resolved.rateOverride === undefined) {
      const match = hardwareItems.find((h) => h.id === item.hardwareItemId);
      if (match) resolved.rateOverride = rateAfterDiscount(match);
    }
    return resolved;
  };
  return unitType.cabinetTypeLinks.map((link, index) => ({
    id: `qc-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    cabinetTypeId: link.cabinetTypeId,
    label: cabinetTypeName(link.cabinetTypeId),
    components: unitType.components.filter((c) => c.sourceLinkId === link.id).map(resolve),
    // Unit Type only groups Components per Cabinet Type link — External
    // Finish, Other Panel, and Hardware are unit-wide in the source data,
    // so they attach to the first cabinet slot only, not duplicated across
    // every cabinet.
    externalFinishes: index === 0 ? unitType.externalFinishes.map(resolve) : [],
    hardware: index === 0 ? unitType.hardware.map(resolveHw) : [],
    panels: index === 0 ? unitType.otherPanels.map(resolve) : [],
  }));
}

function UnitTypeSelect({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const unitTypes = useUnitTypes();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const selected = unitTypes.find((u) => u.id === value);
  const results = unitTypes.filter(
    (u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.shortCode.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary">
          {selected ? (
            <span className="min-w-0 truncate font-number">
              {selected.shortCode} — {selected.name}
            </span>
          ) : (
            <span className="min-w-0 truncate text-grey-400">Select Unit Type</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[28rem] p-2">
          <Input autoFocus placeholder="Search unit types" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2 font-number" />
          <div className="flex max-h-52 flex-col overflow-y-auto">
            {results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange(u.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full min-w-0 items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600",
                  u.id === value ? "text-primary" : "text-grey-800"
                )}
              >
                <span className="min-w-0 font-number">
                  {u.shortCode} — {u.name}
                </span>
                {u.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
            {results.length === 0 && <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAddOpen(true);
            }}
            className="mt-1 flex w-full items-center gap-1.5 border-t border-grey-100 px-2 py-2 text-left text-sm font-body font-medium text-primary hover:bg-light-600 rounded-md"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Unit Type
          </button>
        </PopoverContent>
      </Popover>

      <UnitTypeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) => {
          const created = unitTypeStore.createUnitType(values);
          onChange(created.id);
        }}
      />
    </>
  );
}

export function QuoteUnitCard({
  unit,
  index,
  shutterFinishId,
  onChange,
  onRemove,
  onDuplicate,
}: {
  unit: QuoteUnit;
  index: number;
  shutterFinishId: string;
  onChange: (patch: Partial<QuoteUnit>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const unitTypes = useUnitTypes();
  const cabinetTypes = useCabinetTypes();
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingUnitTypeId, setPendingUnitTypeId] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: unit.id });

  const cabinetTypeName = (id: string) => cabinetTypes.find((c) => c.id === id)?.name ?? "Cabinet";
  const selectedUnitType = unitTypes.find((u) => u.id === unit.unitTypeId);

  const duplicateCabinet = (cabinetId: string) => {
    const source = unit.cabinets.find((c) => c.id === cabinetId);
    if (!source) return;
    const sourceIndex = unit.cabinets.indexOf(source);
    const duplicate: QuoteCabinet = {
      ...source,
      id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      components: source.components.map(cloneLineItem),
      externalFinishes: source.externalFinishes.map(cloneLineItem),
      hardware: source.hardware.map((h) => cloneHardware(h, [])),
      panels: source.panels.map(cloneLineItem),
    };
    const cabinets = [...unit.cabinets];
    cabinets.splice(sourceIndex + 1, 0, duplicate);
    onChange({ cabinets });
  };

  const addBlankCabinet = () => {
    const blank: QuoteCabinet = {
      id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      cabinetTypeId: "",
      label: "",
      components: [],
      externalFinishes: [],
      hardware: [],
      panels: [],
    };
    onChange({ cabinets: [...unit.cabinets, blank] });
  };

  const runAutoPopulate = (unitType: UnitType) => {
    const cabinets = buildCabinetsFromUnitType(unitType, cabinetTypeName, unit, hardwareItems, furnitureItems);
    onChange({
      unitTypeId: unitType.id,
      // New Shutter rows start on the Material Specification's Shutter
      // Finish, same as the live-sync when that field changes afterward.
      cabinets: shutterFinishId
        ? cabinets.map((c) => ({
            ...c,
            externalFinishes: c.externalFinishes.map((f) => ({ ...f, externalColourId: shutterFinishId })),
          }))
        : cabinets,
      autoPopulated: true,
    });
  };

  const handleUnitTypeChange = (id: string) => {
    if (unit.autoPopulated && unit.unitTypeId !== id) {
      setPendingUnitTypeId(id);
    } else {
      onChange({ unitTypeId: id });
    }
  };

  const total = unitTotal(unit, furnitureItems, hardwareItems);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex flex-col gap-4 rounded-xl border border-[#D9C8C9] bg-[#D9C8C9] p-4", isDragging && "opacity-50")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex items-center gap-2 sm:contents">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder unit"
            className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-grey-300 hover:text-grey-500 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label={unit.collapsed ? "Expand unit" : "Collapse unit"}
            onClick={() => onChange({ collapsed: !unit.collapsed })}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-grey-100 bg-card text-grey-500 hover:text-grey-800"
          >
            {unit.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-transparent text-sm font-number font-semibold text-primary">
            {index + 1}
          </div>

          <div className="ml-auto flex items-center gap-1 sm:hidden">
            <button
              type="button"
              aria-label="Duplicate unit"
              title="Duplicate this unit"
              onClick={onDuplicate}
              className="rounded-md p-1.5 text-grey-400 hover:bg-primary-transparent hover:text-primary"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Remove unit"
              onClick={() => setDeleteOpen(true)}
              className="rounded-md p-1.5 text-grey-400 hover:bg-error-transparent hover:text-error"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-40">
          <Label>Space</Label>
          <MaterialReferenceSelect
            category="space"
            value={unit.spaceId ?? ""}
            onChange={(id) => onChange({ spaceId: id })}
          />
        </div>

        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-56 sm:flex-1">
          <Label>Unit Type</Label>
          <UnitTypeSelect value={unit.unitTypeId} onChange={handleUnitTypeChange} />
        </div>

        <div className="grid grid-cols-4 gap-2 sm:contents">
          <div className="flex flex-col gap-1.5 sm:w-24">
            <Label htmlFor={`w-${unit.id}`}>W</Label>
            <Input className="bg-card font-number" id={`w-${unit.id}`} type="number" value={unit.width || ""} onChange={(e) => onChange({ width: Number(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-1.5 sm:w-24">
            <Label htmlFor={`d-${unit.id}`}>D</Label>
            <Input className="bg-card font-number" id={`d-${unit.id}`} type="number" value={unit.depth || ""} onChange={(e) => onChange({ depth: Number(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-1.5 sm:w-24">
            <Label htmlFor={`h-${unit.id}`}>H</Label>
            <Input className="bg-card font-number" id={`h-${unit.id}`} type="number" value={unit.height || ""} onChange={(e) => onChange({ height: Number(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-1.5 sm:w-20">
            <Label htmlFor={`qty-${unit.id}`}>Qty</Label>
            <Input className="bg-card font-number" id={`qty-${unit.id}`} type="number" min={1} value={unit.qty || ""} onChange={(e) => onChange({ qty: Number(e.target.value) })} />
          </div>
        </div>

        <Button type="button" disabled={!selectedUnitType} onClick={() => selectedUnitType && runAutoPopulate(selectedUnitType)} className="w-full sm:w-auto">
          <Sparkles className="h-4 w-4" />
          Auto Populate
        </Button>

        <div className="flex items-center justify-end gap-3 sm:ml-auto">
          <span className="text-sm font-body font-semibold text-grey-900">Unit Total: <span className="font-number">₹{total.toFixed(2)}</span></span>
          <button
            type="button"
            aria-label="Duplicate unit"
            title="Duplicate this unit"
            onClick={onDuplicate}
            className="hidden rounded-md p-1.5 text-grey-400 hover:bg-primary-transparent hover:text-primary sm:inline-flex"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Remove unit"
            onClick={() => setDeleteOpen(true)}
            className="hidden rounded-md p-1.5 text-grey-400 hover:bg-error-transparent hover:text-error sm:inline-flex"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!unit.collapsed && (
        <div className="flex flex-col gap-3 sm:pl-12">
          {unit.cabinets.map((cabinet, cabinetIndex) => (
            <QuoteCabinetGroup
              key={cabinet.id}
              cabinet={cabinet}
              index={`${index + 1}.${cabinetIndex + 1}`}
              unit={unit}
              total={cabinetTotal(cabinet, unit, furnitureItems, hardwareItems)}
              onChange={(patch) => onChange({ cabinets: unit.cabinets.map((c) => (c.id === cabinet.id ? { ...c, ...patch } : c)) })}
              onRemove={() => onChange({ cabinets: unit.cabinets.filter((c) => c.id !== cabinet.id) })}
              onDuplicate={() => duplicateCabinet(cabinet.id)}
              onAddCabinet={cabinetIndex === unit.cabinets.length - 1 ? addBlankCabinet : undefined}

            />
          ))}

          {unit.cabinets.length === 0 && (
            <Button type="button" size="sm" variant="outline" className="w-fit" onClick={addBlankCabinet}>
              <Plus className="h-3.5 w-3.5" />
              Add Cabinet
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={pendingUnitTypeId !== null} onOpenChange={(open) => !open && setPendingUnitTypeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This unit was already Auto Populated</AlertDialogTitle>
            <AlertDialogDescription>
              You picked a different Unit Type. Replacing runs Auto Populate again and discards any
              customizations made to the current Cabinets/Components. Keeping just swaps the Unit Type
              reference without touching what's already here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setPendingUnitTypeId(null)}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (pendingUnitTypeId) onChange({ unitTypeId: pendingUnitTypeId });
                setPendingUnitTypeId(null);
              }}
            >
              Keep current components
            </Button>
            <Button
              type="button"
              onClick={() => {
                const newType = unitTypes.find((u) => u.id === pendingUnitTypeId);
                if (newType) runAutoPopulate(newType);
                setPendingUnitTypeId(null);
              }}
            >
              Replace with new defaults
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete Unit ${index + 1}?`}
        description="This removes the unit and every cabinet, component, and hardware line item under it from the quote."
        onConfirm={onRemove}
      />
    </div>
  );
}
