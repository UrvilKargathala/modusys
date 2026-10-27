"use client";

import { useState } from "react";
import { Plus, ChevronsDown, ChevronsUp, Boxes, ChevronDown, ChevronRight, Search } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { QuoteUnitCard, UNIT_ROW_GRID } from "@/components/quotes/create/quote-unit-card";
import { FurnitureLineItemRow, FurnitureTableHeader, furnitureTableColumns } from "@/components/templates/furniture-line-item-row";
import { UnitTypeHardwareRow, HardwareTableHeader, HARDWARE_TABLE_COLUMNS } from "@/components/templates/unit-type-hardware-row";
import { effectiveFurnitureRate, effectiveHardwareRate, evaluateFormula, SQMM_PER_SQFT, unitSqFt, unitTotal } from "@/lib/quote-pricing";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { nextLineSort, SortLabel, type LineSort } from "@/components/templates/line-sort";
import { formatInr } from "@/lib/format";
import { blankQuoteUnit, type QuoteCabinet, type QuoteUnit } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Deep clone a unit and regenerate every id in the tree so React and dnd-kit
// treat the duplicate as its own row.
function cloneUnit(u: QuoteUnit): QuoteUnit {
  return {
    ...u,
    id: newId("qu"),
    cabinets: u.cabinets.map((c) => ({
      ...c,
      id: newId("qc"),
      components: c.components.map((li) => ({ ...li, id: newId("qli") })),
      externalFinishes: c.externalFinishes.map((li) => ({ ...li, id: newId("qli") })),
      panels: c.panels.map((li) => ({ ...li, id: newId("qli") })),
      hardware: c.hardware.map((h) => ({ ...h, id: newId("qhw") })),
    })),
  };
}

export function UnitsSection({
  units,
  shutterFinishId,
  shutterFinishOverrides,
  onChange,
  bare = false,
}: {
  units: QuoteUnit[];
  shutterFinishId: string;
  shutterFinishOverrides?: Record<string, string>;
  onChange: (units: QuoteUnit[]) => void;
  // Shown inside the Units tab: no frame and no header row; the tab line carries the count and the Expand / Collapse / Add Unit buttons.
  bare?: boolean;
}) {
  const setAllCollapsed = (collapsed: boolean) => onChange(units.map((u) => ({ ...u, collapsed })));
  const [collapsedState, setSectionCollapsed] = useState(true);
  const sectionCollapsed = !bare && collapsedState;
  const addUnit = () => onChange([...units, blankQuoteUnit()]);
  // Filter: All Units (the table), or every Shutter / Hardware line of the quote listed together, still editable.
  const [view, setView] = useState<"units" | "shutter" | "hardware" | "merge">("units");
  const hardwarePrices = useHardwarePriceItems();
  const furniturePrices = useFurniturePriceItems();
  const categories = useMaterialItems("category");
  const brands = useMaterialItems("brand");
  const levelTypes = useMaterialItems("level-type");
  const unitNames = useMaterialItems("unit");
  const spaces = useMaterialItems("space");
  const unitTypes = useUnitTypes();
  const components = useMaterialItems("furniture-component");
  const thicknesses = useMaterialItems("thickness");
  const rawMaterials = useMaterialItems("raw-material-type");
  const externals = useMaterialItems("external-colour");
  const internals = useMaterialItems("internal-colour");
  const nameOf = (list: { id: string; name: string }[], id?: string) => list.find((m) => m.id === id)?.name ?? "";
  // Search box and column sorting of the Shutter / Hardware / Merge Hardware tables.
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LineSort>(null);
  const onSort = (key: string) => setSort((cur) => nextLineSort(cur, key));
  const changeView = (k: typeof view) => {
    setView(k);
    setQuery("");
    setSort(null);
  };
  const compare = (a: string | number, b: string | number) =>
    typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  // Keeps the rows that contain the search text in any column, then orders them by the clicked column.
  const arrange = <T,>(rows: T[], valuesOf: (r: T) => Record<string, string | number>): T[] => {
    const q = query.trim().toLowerCase();
    let out = q ? rows.filter((r) => Object.values(valuesOf(r)).join(" ").toLowerCase().includes(q)) : rows;
    if (sort) out = [...out].sort((a, b) => compare(valuesOf(a)[sort.key] ?? "", valuesOf(b)[sort.key] ?? "") * (sort.dir === "asc" ? 1 : -1));
    return out;
  };
  const hardwareValues = (h: QuoteCabinet["hardware"][number], no: string, qtyAmount?: { qty: number; amount: number }, u?: QuoteUnit) => {
    const rate = effectiveHardwareRate(h, hardwarePrices) ?? 0;
    const qty = qtyAmount?.qty ?? (u ? evaluateFormula(h.qtyFormula, { W: u.width, D: u.depth, H: u.height }) : 0);
    return {
      no,
      articleNo: h.articleNo ?? "",
      category: nameOf(categories, h.categoryId),
      brand: nameOf(brands, h.brandId),
      description: h.description ?? "",
      levelType: nameOf(levelTypes, h.levelTypeId),
      qty,
      unit: nameOf(unitNames, hardwarePrices.find((x) => x.id === h.hardwareItemId)?.unitId),
      rate,
      amount: qtyAmount?.amount ?? rate * qty,
    };
  };
  const unitValues = (u: QuoteUnit, index: number) => {
    const type = unitTypes.find((t) => t.id === u.unitTypeId);
    return {
      no: index + 1,
      space: nameOf(spaces, u.spaceId ?? ""),
      unitType: type ? `${type.shortCode} — ${type.name}` : "",
      w: u.width,
      d: u.depth,
      h: u.height,
      qty: u.qty,
      sqft: unitSqFt(u),
      amount: unitTotal(u, furniturePrices, hardwarePrices),
      remarks: u.remark ?? "",
    };
  };
  const shutterValues = (f: QuoteCabinet["externalFinishes"][number], u: QuoteUnit, no: string) => {
    const vars = { W: u.width, D: u.depth, H: u.height };
    const width = evaluateFormula(f.widthFormula, vars);
    const height = evaluateFormula(f.heightFormula, vars);
    const sqft = ((width * height) / SQMM_PER_SQFT) * f.qty;
    const rate = effectiveFurnitureRate(f, furniturePrices) ?? 0;
    return {
      no,
      name: nameOf(components, f.componentTypeId),
      width,
      height,
      qty: f.qty,
      thk: nameOf(thicknesses, f.thicknessId),
      sqft,
      raw: nameOf(rawMaterials, f.rawMaterialTypeId),
      external: nameOf(externals, f.externalColourId),
      internal: nameOf(internals, f.internalColourId),
      amount: rate * sqft,
      rate,
    };
  };
  // Merge Hardware: the same hardware item (same article / category / brand / description / level type / rate) repeated across the
  // quote is added up into one line with its total quantity and amount.
  const merged = (() => {
    const map = new Map<string, { item: QuoteCabinet["hardware"][number]; qty: number; amount: number; lines: number; rate: number; ids: Set<string> }>();
    for (const u of units)
      for (const c of u.cabinets)
        for (const h of c.hardware) {
          const rate = effectiveHardwareRate(h, hardwarePrices) ?? 0;
          const qty = evaluateFormula(h.qtyFormula, { W: u.width, D: u.depth, H: u.height });
          const key = [h.hardwareItemId || [h.articleNo, h.categoryId, h.brandId, h.description].join("~"), h.levelTypeId ?? "", rate].join("|");
          const row = map.get(key) ?? { item: h, qty: 0, amount: 0, lines: 0, rate, ids: new Set<string>() };
          row.ids.add(h.id);
          row.qty += qty;
          row.amount += rate * qty;
          row.lines += 1;
          map.set(key, row);
        }
    return [...map.values()];
  })();
  const dimsOf = (u: QuoteUnit) => ({ W: u.width, D: u.depth, H: u.height });
  // Applies a change to every hardware line (`fn` returns the new line, or null to delete it).
  const updateHardware = (fn: (h: QuoteCabinet["hardware"][number], u: QuoteUnit) => QuoteCabinet["hardware"][number] | null) =>
    onChange(units.map((u) => ({ ...u, cabinets: u.cabinets.map((c) => ({ ...c, hardware: c.hardware.flatMap((h) => { const r = fn(h, u); return r ? [r] : []; }) })) })));
  // Editing a merged line edits every line behind it: other fields are set on all of them; a new total quantity adds the difference to the
  // first lines (or takes it off from the first lines), so the total comes out as typed.
  const editMerged = (m: (typeof merged)[number], patch: Partial<QuoteCabinet["hardware"][number]>) => {
    const { qtyFormula, ...rest } = patch;
    const first = units.flatMap((u) => u.cabinets.flatMap((c) => c.hardware.map((h) => ({ u, h })))).find((x) => m.ids.has(x.h.id));
    let remaining = qtyFormula !== undefined && first ? evaluateFormula(qtyFormula, dimsOf(first.u)) - m.qty : 0;
    updateHardware((h, u) => {
      if (!m.ids.has(h.id)) return h;
      const next = { ...h, ...rest };
      if (remaining !== 0) {
        const cur = evaluateFormula(h.qtyFormula, dimsOf(u));
        const target = remaining > 0 ? cur + remaining : cur - Math.min(cur, -remaining);
        remaining = remaining > 0 ? 0 : remaining + (cur - target);
        next.qtyFormula = String(target);
      }
      return next;
    });
  };
  const mergedShown = arrange(merged.map((m, i) => ({ m, i })), ({ m, i }) => hardwareValues(m.item, String(i + 1), { qty: m.qty, amount: m.amount }));
  const removeMerged = (m: (typeof merged)[number]) => updateHardware((h) => (m.ids.has(h.id) ? null : h));
  const count = (pick: (c: QuoteCabinet) => number) => units.reduce((n, u) => n + u.cabinets.reduce((m, c) => m + pick(c), 0), 0);
  const shutterCount = count((c) => c.externalFinishes.length);
  const hardwareCount = count((c) => c.hardware.length);
  const patchCabinet = (unitId: string, cabinetId: string, patch: Partial<QuoteCabinet>) =>
    onChange(units.map((u) => (u.id === unitId ? { ...u, cabinets: u.cabinets.map((c) => (c.id === cabinetId ? { ...c, ...patch } : c)) } : u)));


  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  // Search and sorting of the units table; each unit keeps its own number.
  const shownUnits = arrange(units.map((unit, index) => ({ unit, index })), ({ unit, index }) => unitValues(unit, index));
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = units.findIndex((u) => u.id === active.id);
    const newIndex = units.findIndex((u) => u.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(units, oldIndex, newIndex));
  };

  return (
    <section className={cn("flex flex-col gap-2 quote-form", !bare && "rounded-xl border border-blush bg-blush", !bare && (sectionCollapsed ? "p-4" : "p-6"))}>
      {!bare && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSectionCollapsed((c) => !c)}
            className="flex items-center gap-2 text-left"
            aria-label={sectionCollapsed ? "Expand Units" : "Collapse Units"}
          >
            {sectionCollapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
            <h2 className="font-heading text-lg font-semibold text-grey-900">Units</h2>
          </button>
          {!sectionCollapsed && units.length > 0 && (
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setAllCollapsed(false)}>
                <ChevronsDown className="h-3.5 w-3.5" />
                Expand All
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setAllCollapsed(true)}>
                <ChevronsUp className="h-3.5 w-3.5" />
                Collapse All
              </Button>
            </div>
          )}
        </div>
      )}

      {bare && units.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-fit rounded-lg border border-grey-100 p-0.5" role="tablist" aria-label="Show">
            {([["units", "All Units", units.length], ["shutter", "Shutter", shutterCount], ["hardware", "Hardware", hardwareCount], ["merge", "Merge Hardware", merged.length]] as const).map(([k, label, n]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={view === k}
                onClick={() => changeView(k)}
                className={`rounded-md px-3 py-1 text-sm font-body font-medium transition-colors ${view === k ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600"}`}
              >
                {label} <span className="font-number">({n})</span>
              </button>
            ))}
          </div>
          {bare && (
            <div className="relative w-64 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search the lines"
                className="w-full rounded-lg border border-grey-100 bg-card py-1.5 pl-8 pr-3 text-sm font-body text-grey-900 outline-none placeholder:text-grey-300 focus:border-primary"
              />
            </div>
          )}
        </div>
      )}

      {bare && view === "merge" && units.length > 0 ? (
        mergedShown.length === 0 ? (
          <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">{merged.length === 0 ? "No hardware lines to merge yet." : "No lines match your search."}</p>
        ) : (
          <div className="quote-dense">
            <div className="-mx-2 overflow-x-auto">
              <div className="min-w-[1060px]">
                <HardwareTableHeader withNo sort={sort} onSort={onSort} />
                <DndContext sensors={sensors} collisionDetection={closestCenter}>
                  <SortableContext items={mergedShown.map(({ m }) => m.item.id)} strategy={verticalListSortingStrategy}>
                    {mergedShown.map(({ m, i }) => (
                      <UnitTypeHardwareRow
                        key={m.item.id}
                        table
                        rowNo={String(i + 1)}
                        // The merged line shows the total quantity; the first line behind it supplies the other details.
                        value={{ ...m.item, qtyFormula: String(m.qty) }}
                        onChange={(patch) => editMerged(m, patch)}
                        onRemove={() => removeMerged(m)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <div className="flex justify-between border-t border-grey-100 bg-primary-transparent px-3 py-1.5 text-[11px] font-body font-semibold text-grey-900">
                  <span>Total ({merged.reduce((t, m) => t + m.lines, 0)} lines merged into {merged.length})</span>
                  <span className="[font-family:var(--font-manrope)]">{formatInr(merged.reduce((t, m) => t + m.amount, 0))}</span>
                </div>
              </div>
            </div>
          </div>
        )
      ) : bare && view !== "units" && units.length > 0 ? (
        <div className="quote-dense">
          {(() => {
            // One table of every shutter (or hardware) line in the quote, numbered by unit: 1.1, 1.2, 1.3 ... then 2.1 ...
            const numbered = <T,>(pick: (c: QuoteCabinet) => T[]) =>
              units.flatMap((u, i) => {
                let n = 0;
                return u.cabinets.flatMap((c) => pick(c).map((item) => ({ u, c, item, no: `${i + 1}.${++n}` })));
              });
            const shutterRows = view === "shutter" ? numbered((c) => c.externalFinishes) : [];
            const hardwareRows = view === "hardware" ? numbered((c) => c.hardware) : [];
            const rows = [...shutterRows, ...hardwareRows];
            const shownShutter = arrange(shutterRows, (r) => shutterValues(r.item, r.u, r.no));
            const shownHardware = arrange(hardwareRows, (r) => hardwareValues(r.item, r.no, undefined, r.u));
            if (rows.length === 0) {
              return (
                <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">
                  No {view === "shutter" ? "shutter" : "hardware"} lines yet. Open a unit and use its Add {view === "shutter" ? "Shutter" : "Hardware"} button.
                </p>
              );
            }
            if (shownShutter.length + shownHardware.length === 0) {
              return <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">No lines match your search.</p>;
            }
            const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            return (
              <div className="-mx-2 overflow-x-auto">
                <div className="min-w-[1060px]">
                  {view === "shutter" ? <FurnitureTableHeader showComponentName showLevelType={false} nameLabel="External Finish" withNo sort={sort} onSort={onSort} /> : <HardwareTableHeader withNo sort={sort} onSort={onSort} />}
                  {/* Dragging is off here (the number takes the handle's place); rows are reordered inside their unit. */}
                  <DndContext sensors={sensors} collisionDetection={closestCenter}>
                    <SortableContext items={[...shownShutter, ...shownHardware].map((r) => r.item.id)} strategy={verticalListSortingStrategy}>
                      {shownShutter.map(({ u, c, item, no }) => (
                          <FurnitureLineItemRow
                            key={item.id}
                            table
                            rowNo={no}
                            value={item}
                            label="External Finish"
                            showComponentName
                            totalSqFt={
                              ((evaluateFormula(item.widthFormula, { W: u.width, D: u.depth, H: u.height }) * evaluateFormula(item.heightFormula, { W: u.width, D: u.depth, H: u.height })) / SQMM_PER_SQFT) * item.qty
                            }
                            unitDims={{ W: u.width, D: u.depth, H: u.height }}
                            onChange={(patch) => patchCabinet(u.id, c.id, { externalFinishes: c.externalFinishes.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) })}
                            onRemove={() => patchCabinet(u.id, c.id, { externalFinishes: c.externalFinishes.filter((x) => x.id !== item.id) })}
                            onCopy={() => {
                              const at = c.externalFinishes.findIndex((x) => x.id === item.id);
                              const next = [...c.externalFinishes];
                              next.splice(at + 1, 0, { ...item, id: newId("qli") });
                              patchCabinet(u.id, c.id, { externalFinishes: next });
                            }}
                          />
                        ))}
                      {shownHardware.map(({ u, c, item, no }) => (
                          <UnitTypeHardwareRow
                            key={item.id}
                            table
                            rowNo={no}
                            value={item}
                            onChange={(patch) => patchCabinet(u.id, c.id, { hardware: c.hardware.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) })}
                            onRemove={() => patchCabinet(u.id, c.id, { hardware: c.hardware.filter((x) => x.id !== item.id) })}
                            onCopy={() => {
                              const at = c.hardware.findIndex((x) => x.id === item.id);
                              const next = [...c.hardware];
                              next.splice(at + 1, 0, { ...item, id: newId("qhw") });
                              patchCabinet(u.id, c.id, { hardware: next });
                            }}
                          />
                      ))}
                    </SortableContext>
                  </DndContext>
                  {/* Hardware: the amount total of the lines listed above, under the Amount column. */}
                  {view === "hardware" && shownHardware.length > 0 && (
                    <div className="grid items-center gap-x-1.5 border-t border-grey-100 bg-[var(--table-head)] px-2 py-1.5 text-sm font-semibold text-grey-900" style={{ gridTemplateColumns: HARDWARE_TABLE_COLUMNS.replace("20px", "44px") }}>
                      <span style={{ gridColumn: "1 / 10" }}>Total ({shownHardware.length} lines)</span>
                      <span className="num text-right">₹{shownHardware.reduce((n, r) => n + hardwareValues(r.item, r.no, undefined, r.u).amount, 0).toFixed(2)}</span>
                      <span />
                    </div>
                  )}
                  {/* Shutter: the totals of the lines listed above, under their own columns (Qty, Sq.ft and Amount). */}
                  {view === "shutter" && shownShutter.length > 0 && (
                    <div className="grid items-center gap-x-1.5 border-t border-grey-100 bg-[var(--table-head)] px-2 py-1.5 text-sm font-semibold text-grey-900" style={{ gridTemplateColumns: furnitureTableColumns(true, false, true) }}>
                      <span style={{ gridColumn: "1 / 5" }}>Total</span>
                      <span className="num text-center">{shownShutter.reduce((n, r) => n + r.item.qty, 0)}</span>
                      <span />
                      <span className="num text-center">{shownShutter.reduce((n, r) => n + shutterValues(r.item, r.u, r.no).sqft, 0).toFixed(2)}</span>
                      <span style={{ gridColumn: "8 / 12" }} />
                      <span className="num text-right">₹{shownShutter.reduce((n, r) => n + shutterValues(r.item, r.u, r.no).amount, 0).toFixed(2)}</span>
                      <span />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
      <div className={cn("flex flex-col gap-2", sectionCollapsed && "hidden")}>
        {units.length === 0 ? (
          <EmptyState icon={Boxes} message='No units added yet. Click "Add Unit" to start pricing this quote.' />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={shownUnits.map(({ unit }) => unit.id)} strategy={verticalListSortingStrategy}>
              <div className="-mx-2 overflow-x-auto">
               <div className="min-w-[1020px]">
                <div className={cn(UNIT_ROW_GRID, "unit-top unit-head bg-[var(--table-head)] px-2 py-1 text-xs font-body font-medium text-grey-900")}>
                  <span className="col-span-3" />
                  <SortLabel label="Space" k="space" sort={sort} onSort={onSort} />
                  <SortLabel label="Unit Type" k="unitType" sort={sort} onSort={onSort} />
                  <span className="text-center"><SortLabel label="W" k="w" sort={sort} onSort={onSort} /></span>
                  <span className="text-center"><SortLabel label="D" k="d" sort={sort} onSort={onSort} /></span>
                  <span className="text-center"><SortLabel label="H" k="h" sort={sort} onSort={onSort} /></span>
                  <span className="text-center"><SortLabel label="Qty" k="qty" sort={sort} onSort={onSort} /></span>
                  <span className="text-right"><SortLabel label="Sq.Ft" k="sqft" sort={sort} onSort={onSort} /></span>
                  <span className="text-right"><SortLabel label="Amount" k="amount" sort={sort} onSort={onSort} /></span>
                  <span />
                  <SortLabel label="Remarks" k="remarks" sort={sort} onSort={onSort} />
                </div>
                {shownUnits.length === 0 && <p className="px-3 py-6 text-center text-sm font-body text-grey-400">No units match your search.</p>}
                {shownUnits.map(({ unit, index }) => (
                  <QuoteUnitCard
                    key={unit.id}
                    unit={unit}
                    index={index}
                    shutterFinishId={shutterFinishId}
                    shutterFinishOverrides={shutterFinishOverrides}

                    onChange={(patch) => onChange(units.map((u) => (u.id === unit.id ? { ...u, ...patch } : u)))}
                    onRemove={() => onChange(units.filter((u) => u.id !== unit.id))}
                    onDuplicate={() => {
                      const next = [...units];
                      next.splice(index + 1, 0, cloneUnit(unit));
                      onChange(next);
                    }}
                  />
                ))}
               </div>
              </div>
            </SortableContext>
          </DndContext>
        )}

        {!bare && (
          <Button type="button" variant="outline" className="w-fit" onClick={addUnit}>
            <Plus className="h-4 w-4" />
            Add Unit
          </Button>
        )}
      </div>
      )}
    </section>
  );
}
