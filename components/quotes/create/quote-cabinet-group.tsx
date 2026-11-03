"use client";

import { useContext, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Calculator, Check, ChevronDown, ChevronRight, Copy, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PanelCalculatorContext } from "@/components/shared/panel-calculator-context";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { CabinetFormulasContext, FurnitureLineItemRow, FurnitureTable, cabinetFormulas } from "@/components/templates/furniture-line-item-row";
import { UnitTypeHardwareRow, HardwareTable } from "@/components/templates/unit-type-hardware-row";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SentLinesContext } from "@/components/shared/sent-lines-context";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { groupTotal, groupSqFt, hardwareLineTotal, hardwareQtyHint, evaluateFormula, SQMM_PER_SQFT, resolveLineItemDimensions, carcassUnitFor } from "@/lib/quote-pricing";
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

// Under a cabinet row, the group's arrow sits exactly under the cabinet's own arrow, and its title exactly under the cabinet type box.
// Cabinet row (from the card's inner edge): 28px arrow button (centre 14px) + 8 gap + 64px "1.1. Type:" label (min-w-16) + 8 gap = 108px to the box.
// Group header (no accent border here): its content starts 12px in and the 24px arrow button would centre at 24px, so the arrow gets -10px
// (centre 14px), and the title, which would start 44px in (34px after the arrow moved), gets 74px to land on 108px.
const ARROW_SHIFT = "-ml-2.5";
const TITLE_INDENT = "ml-[74px]";

// Open / closed of each bar and cabinet, remembered while the app is open: switching tabs (All Units, Carcass …) or folding a
// unit unmounts them, and without this they would all come back closed. Keyed by cabinet id + bar.
const openState = new Map<string, boolean>();
function useRememberedCollapsed(key: string | undefined, initial: boolean) {
  const [collapsed, set] = useState(() => (key && openState.has(key) ? openState.get(key)! : initial));
  const setCollapsed = (next: boolean | ((c: boolean) => boolean)) =>
    set((c) => {
      const v = typeof next === "function" ? next(c) : next;
      if (key) openState.set(key, v);
      return v;
    });
  return [collapsed, setCollapsed] as const;
}

// Tick boxes on a group's rows to delete several at once: one in the table header for every row, one per row, and a Delete button
// on the group's bar while something is ticked. A line already on a Purchase Order can't be ticked (its row is locked).
function useTickDelete<T extends { id: string }>(items: T[], onChange: (items: T[]) => void, noun: string, small: boolean) {
  const sent = useContext(SentLinesContext);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The lines the open dialog will delete, kept as they were when it opened (its title must not change while it closes).
  const [doomed, setDoomed] = useState<string[]>([]);
  const free = items.filter((i) => !sent?.has(i.id)).map((i) => i.id);
  const live = free.filter((id) => ticked.has(id));
  const box = (ids: string[], label: string) => (
    <input
      type="checkbox"
      aria-label={`Select ${label}`}
      disabled={ids.length === 0}
      checked={ids.length > 0 && ids.every((id) => ticked.has(id))}
      onChange={(e) =>
        setTicked((cur) => {
          const next = new Set(cur);
          for (const id of ids) if (e.target.checked) next.add(id); else next.delete(id);
          return next;
        })
      }
      className="h-3.5 w-3.5 cursor-pointer accent-primary disabled:cursor-default"
    />
  );
  return {
    headTick: box(free, `every ${noun}`),
    rowTick: (id: string) => box([id], noun),
    deleteButton: live.length > 0 && (
      <Button type="button" size={small ? "xs" : "sm"} variant="destructive" className="text-xs" onClick={() => { setDoomed(live); setConfirmOpen(true); }}>
        <Trash2 className="h-3.5 w-3.5" />
        Delete <span className="font-number">{live.length}</span>
      </Button>
    ),
    dialog: (
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${doomed.length} ${doomed.length === 1 ? noun : `${noun} lines`}?`}
        description="This removes the ticked lines and their pricing from the quote."
        onConfirm={() => {
          onChange(items.filter((i) => !doomed.includes(i.id)));
          setTicked(new Set());
        }}
      />
    ),
  };
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
  alignTitle,
  stateKey,
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
  // Under a cabinet row: the title starts exactly under the cabinet type box (see TITLE_INDENT).
  alignTitle?: boolean;
  // Remembers this bar's open / closed across tab switches (see useRememberedCollapsed).
  stateKey?: string;
}) {
  const furnitureItems = useFurniturePriceItems();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const subtotal = groupTotal(items, unit, furnitureItems);
  const totalSqFt = groupSqFt(items, unit);
  const isViewMode = useSearchParams().get("mode") === "view";
  const [collapsed, setCollapsed] = useRememberedCollapsed(stateKey, !defaultOpen);
  // Requirement Order only: the Panel Calculator on Other Panel (see PanelCalculatorContext).
  const PanelCalculator = useContext(PanelCalculatorContext);
  const [calcOpen, setCalcOpen] = useState(false);
  const tick = useTickDelete(items, onChange, label.toLowerCase(), !!alignTitle);

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
    <div className={cn("flex flex-col gap-2 rounded-lg bg-light-600", collapsed ? "p-0" : "p-3", !alignTitle && "border-l-4", !alignTitle && a.border)}>
      <div
        className={cn("flex cursor-pointer select-none items-center justify-between px-3", collapsed ? "" : "-mx-3 -mt-3", alignTitle ? "py-0.5" : "py-1", collapsed ? "rounded-md" : "rounded-t-md", a.header)}
        // Anywhere on the bar opens / closes it; the buttons on the bar keep doing their own job.
        onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) setCollapsed((c) => !c); }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            onClick={() => setCollapsed((c) => !c)}
            className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-grey-400 hover:bg-card hover:text-grey-700", alignTitle && ARROW_SHIFT)}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <h4 className={cn("text-xs font-body font-semibold uppercase tracking-wide text-grey-700", alignTitle && TITLE_INDENT)}>{title}</h4>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-number text-grey-500">{totalSqFt.toFixed(2)} sq.ft</span>
          <span className="text-xs font-number font-semibold text-grey-700">₹{subtotal.toFixed(2)}</span>
          {tick.deleteButton}
          {PanelCalculator && label === "Other Panel" && (
            <Button type="button" size={alignTitle ? "xs" : "sm"} className="text-xs" variant="outline" onClick={() => setCalcOpen(true)}>
              <Calculator className="h-3.5 w-3.5" />
              Calculator
            </Button>
          )}
          <Button
            type="button"
            size={alignTitle ? "xs" : "sm"} className="text-xs"
            variant="outline"
            onClick={() => onChange([...items, blankLineItem()])}
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        </div>
      </div>

      {PanelCalculator && calcOpen && (
        <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Panel Calculator</DialogTitle>
              <DialogDescription>Calculate adds the panels to this {title}. Close when you&apos;re done.</DialogDescription>
            </DialogHeader>
            <PanelCalculator
              onAdd={(lines) => {
                onChange([...items, ...lines]);
                setCollapsed(false);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {!collapsed && items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <FurnitureTable showComponentName={showComponentName} showLevelType={!!showLevelType} nameLabel={label} tick={tick.headTick}>
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
                    tick={tick.rowTick(item.id)}
                    totalSqFt={totalSqFt}
                    unitDims={{ W: unit.width, D: unit.depth, H: unit.height }}

                    onChange={(patch) => onChange(items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))}
                    onRemove={() => onChange(items.filter((i) => i.id !== item.id))}
                    onCopy={() => onChange(duplicateAt(items, item.id, () => `qli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`))}
                  />
                );
              })}
            </FurnitureTable>
          </SortableContext>
        </DndContext>
      )}
      {tick.dialog}
    </div>
  );
}

export function HardwareGroup({
  items,
  unit,
  typeHardware,
  onChange,
  hideWhenEmpty,
  defaultOpen,
  alignTitle,
  stateKey,
}: {
  items: UnitTypeHardware[];
  unit: { width: number; depth: number; height: number; qty: number };
  // The unit's Unit Type hardware: its qty formulas for the Qty hover on rows filled before formulas were kept.
  typeHardware?: UnitTypeHardware[];
  onChange: (items: UnitTypeHardware[]) => void;
  hideWhenEmpty?: boolean;
  defaultOpen?: boolean;
  alignTitle?: boolean;
  stateKey?: string;
}) {
  const hardwareItems = useHardwarePriceItems();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const total = items.reduce((sum, h) => sum + hardwareLineTotal(h, unit, hardwareItems), 0);
  const isViewMode = useSearchParams().get("mode") === "view";
  const [collapsed, setCollapsed] = useRememberedCollapsed(stateKey, !defaultOpen);
  const tick = useTickDelete(items, onChange, "hardware", !!alignTitle);

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
    <div className={cn("flex flex-col gap-2 rounded-lg bg-light-600", collapsed ? "p-0" : "p-3", !alignTitle && "border-l-4", !alignTitle && a.border)}>
      <div
        className={cn("flex cursor-pointer select-none items-center justify-between px-3", collapsed ? "" : "-mx-3 -mt-3", alignTitle ? "py-0.5" : "py-1", collapsed ? "rounded-md" : "rounded-t-md", a.header)}
        // Anywhere on the bar opens / closes it; the buttons on the bar keep doing their own job.
        onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) setCollapsed((c) => !c); }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={collapsed ? "Expand Hardware" : "Collapse Hardware"}
            onClick={() => setCollapsed((c) => !c)}
            className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-grey-400 hover:bg-card hover:text-grey-700", alignTitle && ARROW_SHIFT)}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <h4 className={cn("text-xs font-body font-semibold uppercase tracking-wide text-grey-700", alignTitle && TITLE_INDENT)}>Hardware</h4>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-number font-semibold text-grey-700">₹{total.toFixed(2)}</span>
          {tick.deleteButton}
          <Button type="button" size={alignTitle ? "xs" : "sm"} className="text-xs" variant="outline" onClick={() => onChange([...items, blankHardware()])}>
            <Plus className="h-3.5 w-3.5" />
            Add Hardware
          </Button>
        </div>
      </div>

      {!collapsed && items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <HardwareTable tick={tick.headTick}>
              {items.map((item) => (
                <UnitTypeHardwareRow
                  key={item.id}
                  table
                  tick={tick.rowTick(item.id)}
                  qtyHint={hardwareQtyHint(item, unit, typeHardware)}
                  value={item}
                  onChange={(patch) => onChange(items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))}
                  onRemove={() => onChange(items.filter((i) => i.id !== item.id))}
                  onCopy={() => onChange(duplicateAt(items, item.id, () => `qhw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`))}
                />
              ))}
            </HardwareTable>
          </SortableContext>
        </DndContext>
      )}
      {tick.dialog}
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
      <PopoverTrigger className={cn("flex w-full items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card font-body font-semibold text-grey-800 outline-none focus:border-primary", compact ? "h-6 min-w-0 px-2 text-xs" : "h-6 min-w-32 px-3 text-xs")}>
        {selected ? <span className="truncate">{selected.name}</span> : <span className="truncate text-grey-400 font-normal">Select Cabinet Type</span>}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] p-2">
        <Input autoFocus placeholder="Search cabinet types" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2" />
        <div className="flex max-h-52 flex-col overflow-y-auto">
          {results.map((c) => (
            <button data-opt
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
  unit: { width: number; depth: number; height: number; qty: number; unitTypeId?: string | null };
  total: number;
  onChange: (patch: Partial<QuoteCabinet>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onAddCabinet?: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isViewMode = useSearchParams().get("mode") === "view";
  const [collapsed, setCollapsed] = useRememberedCollapsed(`${cabinet.id}:cabinet`, isViewMode);
  const cabinetTypes = useCabinetTypes();
  const selectedCabinetType = cabinetTypes.find((c) => c.id === cabinet.cabinetTypeId);
  // The unit's Unit Type: its Shutter / Other Panel / Hardware formulas for the formula hover (Carcass uses the cabinet type's).
  const unitType = useUnitTypes().find((u) => u.id === unit.unitTypeId);
  const carcassUnit = carcassUnitFor(cabinet, unit);

  const runAutoPopulate = () => {
    if (!selectedCabinetType) return;
    onChange({ components: autoPopulateComponents(selectedCabinetType, carcassUnit) });
  };

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-grey-100 bg-card px-2 py-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={collapsed ? "Expand cabinet" : "Collapse cabinet"}
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-6 w-7 shrink-0 items-center justify-center rounded-md border border-grey-100 bg-light-600 text-grey-500 hover:text-grey-800"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span className="min-w-16 shrink-0 text-xs font-body font-medium text-grey-400">
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
                  className="h-6 w-16 bg-card text-xs md:text-xs font-number [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
              className="h-6 w-14 bg-card text-xs md:text-xs font-number [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
        <Button type="button" size="icon-xs" aria-label="Auto Populate" title="Auto Populate" disabled={!selectedCabinetType} onClick={runAutoPopulate}>
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
        {selectedCabinetType && cabinet.components.length === 0 && (
          <Button type="button" size="xs" className="text-xs" variant="outline" onClick={() => onChange({ components: [blankLineItem()] })}>
            <Plus className="h-3.5 w-3.5" />
            Carcass
          </Button>
        )}
        {cabinet.externalFinishes.length === 0 && (
          <Button type="button" size="xs" className="text-xs" variant="outline" onClick={() => onChange({ externalFinishes: [blankLineItem()] })}>
            <Plus className="h-3.5 w-3.5" />
            Shutter
          </Button>
        )}
        {cabinet.panels.length === 0 && (
          <Button type="button" size="xs" className="text-xs" variant="outline" onClick={() => onChange({ panels: [blankLineItem()] })}>
            <Plus className="h-3.5 w-3.5" />
            Other Panel
          </Button>
        )}
        {cabinet.hardware.length === 0 && (
          <Button type="button" size="xs" className="text-xs" variant="outline" onClick={() => onChange({ hardware: [blankHardware()] })}>
            <Plus className="h-3.5 w-3.5" />
            Hardware
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onAddCabinet && (
            <Button type="button" size="xs" className="text-xs" variant="outline" onClick={onAddCabinet}>
              <Plus className="h-3.5 w-3.5" />
              Add Cabinet
            </Button>
          )}
          <span className="text-xs font-body font-semibold text-grey-900">Cabinet Total: <span className="font-number">₹{total.toFixed(2)}</span></span>
          <button
            type="button"
            aria-label="Duplicate cabinet"
            title="Duplicate this cabinet"
            onClick={onDuplicate}
            className="rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-grey-700"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Remove cabinet"
            onClick={() => setDeleteOpen(true)}
            className="rounded-md p-1 text-grey-400 hover:bg-error-transparent hover:text-error"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* No Carcass bar until a cabinet type is picked and it has components (Auto Populate or + Carcass adds them). */}
          {selectedCabinetType && cabinet.components.length > 0 && (
          <CabinetFormulasContext.Provider value={cabinetFormulas(selectedCabinetType.components)}>
          <FurnitureGroup
            title="Carcass"
            alignTitle
            stateKey={`${cabinet.id}:carcass`}
            label="Component"
            showComponentName
            accent="primary"
            items={cabinet.components}
            unit={carcassUnit}
            addLabel="Add Component"
            onChange={(components) => onChange({ components })}

          />
          </CabinetFormulasContext.Provider>
          )}
          <CabinetFormulasContext.Provider value={cabinetFormulas(unitType?.externalFinishes)}>
          <FurnitureGroup
            title="Shutter"
            alignTitle
            stateKey={`${cabinet.id}:shutter`}
            label="External Finish"
            showComponentName
            accent="teal"
            items={cabinet.externalFinishes}
            unit={unit}
            addLabel="Add Shutter"
            onChange={(externalFinishes) => onChange({ externalFinishes })}
            hideWhenEmpty

          />
          </CabinetFormulasContext.Provider>
          <CabinetFormulasContext.Provider value={cabinetFormulas(unitType?.otherPanels)}>
          <FurnitureGroup
            title="Other Panel"
            alignTitle
            stateKey={`${cabinet.id}:panel`}
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
          </CabinetFormulasContext.Provider>
          <HardwareGroup
            alignTitle
            stateKey={`${cabinet.id}:hardware`}
            items={cabinet.hardware}
            unit={unit}
            typeHardware={unitType?.hardware}
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
