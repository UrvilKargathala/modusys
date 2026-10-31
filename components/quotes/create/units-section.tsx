"use client";

import { useContext, useState } from "react";
import { Plus, ChevronsDown, ChevronsUp, Boxes, ChevronDown, ChevronRight, Search, Send, Sparkles, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CabinetTypeSelect, autoPopulateComponents, blankLineItem } from "@/components/quotes/create/quote-cabinet-group";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SelectField } from "@/components/shared/select-field";
import { PanelCalculatorContext } from "@/components/shared/panel-calculator-context";
import type { FurnitureLineItem } from "@/lib/mock/unit-type";
import { EmptyState } from "@/components/shared/empty-state";
import { QuoteUnitCard, UNIT_ROW_GRID, UNIT_ROW_GRID_TICK } from "@/components/quotes/create/quote-unit-card";
import { FurnitureLineItemRow, FurnitureTableHeader, furnitureTableColumns } from "@/components/templates/furniture-line-item-row";
import { UnitTypeHardwareRow, HardwareTableHeader, HARDWARE_TABLE_COLUMNS } from "@/components/templates/unit-type-hardware-row";
import { carcassUnitFor, effectiveFurnitureRate, effectiveHardwareRate, evaluateFormula, SQMM_PER_SQFT, unitSqFt, unitTotal } from "@/lib/quote-pricing";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { nextLineSort, SortLabel, type LineSort } from "@/components/templates/line-sort";
import { formatInr } from "@/lib/format";
import { blankQuoteUnit, type QuoteCabinet, type QuoteUnit } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

// Carcass, Shutter and Other Panel tabs: one table of that group's lines across the quote, edited in place (as inside the cabinet).
// Carcass is laid out like the Purchase Order: a row per cabinet (its type and carcass size), its components in a table under it.
type FurnLine = QuoteCabinet["components"][number];
const FURN = {
  carcass: { label: "Component", level: false, pick: (c: QuoteCabinet) => c.components, put: (items: FurnLine[]): Partial<QuoteCabinet> => ({ components: items }) },
  shutter: { label: "External Finish", level: false, pick: (c: QuoteCabinet) => c.externalFinishes, put: (items: FurnLine[]): Partial<QuoteCabinet> => ({ externalFinishes: items }) },
  panel: { label: "Other Panel", level: true, pick: (c: QuoteCabinet) => c.panels, put: (items: FurnLine[]): Partial<QuoteCabinet> => ({ panels: items }) },
};
type FurnView = keyof typeof FURN;
// Carcass tab cabinet row: toggle, Sr No, Cabinet Type, Unit, W, D, H, Qty, Sq.ft, Amount, Auto Populate.
const CABINET_ROW = "24px 36px minmax(150px,1fr) minmax(120px,0.8fr) 52px 52px 52px 44px 56px 84px 26px";
// The W/D/H a line's formulas use: Carcass follows its cabinet's own size (when set), the others the unit's.
const dimsFor = (view: FurnView, u: QuoteUnit, c: QuoteCabinet) => {
  const d = view === "carcass" ? carcassUnitFor(c, u) : u;
  return { W: d.width, D: d.depth, H: d.height };
};

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
  send,
}: {
  units: QuoteUnit[];
  shutterFinishId: string;
  shutterFinishOverrides?: Record<string, string>;
  onChange: (units: QuoteUnit[]) => void;
  // Shown inside the Units tab: no frame and no header row; the tab line carries the count and the Expand / Collapse / Add Unit buttons.
  bare?: boolean;
  // Requirement Order only (Send to PO): the line ids that can go to a PO, those already on one (id → PO number), why sending is not
  // possible right now (e.g. unsaved changes) and what Send to PO does with the ticked ids. Adds a tick box to every line of the line tabs.
  send?: { sendable: Set<string>; sent: Map<string, string>; blocked?: string; onSend: (ids: string[]) => void };
}) {
  const setAllCollapsed = (collapsed: boolean) => onChange(units.map((u) => ({ ...u, collapsed })));
  const [collapsedState, setSectionCollapsed] = useState(true);
  const sectionCollapsed = !bare && collapsedState;
  const addUnit = () => onChange([...units, blankQuoteUnit()]);
  // Filter: All Units (the table), or every Carcass / Shutter / Other Panel / Hardware line of the quote listed together, still editable.
  const [view, setView] = useState<"units" | FurnView | "hardware" | "merge" | "pending">("units");
  const furn = view in FURN ? FURN[view as FurnView] : null;
  // Send to PO: the ticked lines (a line already on a PO can't be ticked; once sent it drops out by itself) and the All / Pending / Sent filter.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [lineFilter, setLineFilter] = useState<"all" | "pending" | "sent">("all");
  const canPick = (id: string) => !!send && send.sendable.has(id) && !send.sent.has(id);
  const pickedLive = [...picked].filter(canPick);
  const pick = (ids: string[], on: boolean) => setPicked((cur) => { const next = new Set(cur); for (const id of ids) if (on) next.add(id); else next.delete(id); return next; });
  const passes = (ids: string[]) => !send || lineFilter === "all" || (lineFilter === "sent" ? ids.length > 0 && ids.every((id) => send.sent.has(id)) : ids.some((id) => !send.sent.has(id)));
  // A tick box for one line, a cabinet or a whole table: ticks the lines of it that can still go to a PO. Ticked and greyed out when every
  // line of it is on a PO already.
  const tickInput = (ids: string[], label: string) => {
    if (!send) return null;
    const live = ids.filter(canPick);
    const allSent = ids.length > 0 && ids.every((id) => send.sent.has(id));
    return (
        <input
          type="checkbox"
          aria-label={`Tick ${label}`}
          title={allSent ? `On ${send.sent.get(ids[0])}` : live.length === 0 ? "Nothing to send: no size or qty" : undefined}
          disabled={live.length === 0}
          checked={allSent || (live.length > 0 && live.every((id) => picked.has(id)))}
          onChange={(e) => pick(live, e.target.checked)}
          className="h-3.5 w-3.5 cursor-pointer accent-primary disabled:cursor-default"
        />
    );
  };
  const tickBox = (ids: string[], label: string) => {
    if (!send) return null;
    if (ids.length === 0) return <span className="w-6 shrink-0" />;
    return <span className="flex w-6 shrink-0 items-center justify-center self-stretch">{tickInput(ids, label)}</span>;
  };
  // A table row (or heading) with its tick box in front.
  const withTick = (ids: string[], label: string, node: React.ReactNode, key?: string) =>
    send ? <div key={key} className="flex items-stretch">{tickBox(ids, label)}<div className="min-w-0 flex-1">{node}</div></div> : node;
  const hardwarePrices = useHardwarePriceItems();
  const furniturePrices = useFurniturePriceItems();
  const categories = useMaterialItems("category");
  const brands = useMaterialItems("brand");
  const levelTypes = useMaterialItems("level-type");
  const unitNames = useMaterialItems("unit");
  const spaces = useMaterialItems("space");
  const unitTypes = useUnitTypes();
  const cabinetTypes = useCabinetTypes();
  const components = useMaterialItems("furniture-component");
  const thicknesses = useMaterialItems("thickness");
  const rawMaterials = useMaterialItems("raw-material-type");
  const externals = useMaterialItems("external-colour");
  const internals = useMaterialItems("internal-colour");
  const nameOf = (list: { id: string; name: string }[], id?: string) => list.find((m) => m.id === id)?.name ?? "";

  // Requirement Order: the Panel Calculator on the Other Panel tab too (see PanelCalculatorContext). This tab lists every
  // unit's lines, so its window asks which unit (and cabinet, when a unit has several) gets the panels.
  const PanelCalculator = useContext(PanelCalculatorContext);
  const [calcOpen, setCalcOpen] = useState(false);
  const calcTargets = units.flatMap((u, i) =>
    u.cabinets.map((c, j) => ({
      key: `${u.id}|${c.id}`,
      label: [`${i + 1}. ${nameOf(spaces, u.spaceId ?? "") || "No space"}`, unitTypes.find((t) => t.id === u.unitTypeId)?.name, u.cabinets.length > 1 ? `Cabinet ${i + 1}.${j + 1}` : ""].filter(Boolean).join(" — "),
    }))
  );
  const [calcTarget, setCalcTarget] = useState("");
  const addCalcLines = (lines: FurnitureLineItem[]) => {
    const [unitId, cabinetId] = (calcTarget || calcTargets[0]?.key || "").split("|");
    onChange(units.map((u) => (u.id !== unitId ? u : { ...u, cabinets: u.cabinets.map((c) => (c.id === cabinetId ? { ...c, panels: [...c.panels, ...lines] } : c)) })));
  };
  // Search box and column sorting of the line tables (Carcass, Shutter, Other Panel, Hardware, Merge Hardware).
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LineSort>(null);
  const onSort = (key: string) => setSort((cur) => nextLineSort(cur, key));
  const changeView = (k: typeof view) => {
    // Rate Pending lists the lines without a rate as they are when the tab opens, so a line stays put while its rate is typed in.
    if (k === "pending") setPendingIds(new Set(units.flatMap((u) => u.cabinets.flatMap((c) => [...[...c.components, ...c.externalFinishes, ...c.panels].filter(noFurnRate), ...c.hardware.filter(noHwRate)].map((x) => x.id)))));
    setView(k);
    setQuery("");
    setSort(null);
  };
  const compare = (a: string | number, b: string | number) =>
    typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  // Keeps the rows that contain the search text in any column, then orders them by the clicked column.
  const arrange = <T,>(rows: T[], valuesOf: (r: T) => Record<string, string | number>, search = true): T[] => {
    const q = search ? query.trim().toLowerCase() : "";
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
  const furnValues = (f: FurnLine, vars: { W: number; D: number; H: number }, no: string) => {
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
      level: nameOf(levelTypes, f.levelTypeId),
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
  const mergedShown = arrange(merged.map((m, i) => ({ m, i })), ({ m, i }) => hardwareValues(m.item, String(i + 1), { qty: m.qty, amount: m.amount })).filter(({ m }) => passes([...m.ids]));
  const removeMerged = (m: (typeof merged)[number]) => updateHardware((h) => (m.ids.has(h.id) ? null : h));
  const count = (pick: (c: QuoteCabinet) => number) => units.reduce((n, u) => n + u.cabinets.reduce((m, c) => m + pick(c), 0), 0);
  const furnCount = (v: FurnView) => count((c) => FURN[v].pick(c).length);
  const hardwareCount = count((c) => c.hardware.length);
  // Rate Pending (like the Purchase Order's): every line with no rate (none in the price list and none typed in).
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const noFurnRate = (f: FurnLine) => !(effectiveFurnitureRate(f, furniturePrices) ?? 0);
  const noHwRate = (h: QuoteCabinet["hardware"][number]) => !(effectiveHardwareRate(h, hardwarePrices) ?? 0);
  const pendingCount = count((c) => [...c.components, ...c.externalFinishes, ...c.panels].filter(noFurnRate).length + c.hardware.filter(noHwRate).length);
  const patchCabinet = (unitId: string, cabinetId: string, patch: Partial<QuoteCabinet>) =>
    onChange(units.map((u) => (u.id === unitId ? { ...u, cabinets: u.cabinets.map((c) => (c.id === cabinetId ? { ...c, ...patch } : c)) } : u)));


  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Carcass tab, laid out like the Purchase Order: one row per cabinet (Sr No, Cabinet Type, its unit, carcass W/D/H/Qty, Sq.ft, Amount and Auto
  // Populate), its components in a table under it. Cabinets are numbered through the quote (1, 2, 3 …), their components 1.1, 1.2 …
  // Everything stays editable as inside the cabinet. The search shows a cabinet whose type or unit matches, or only its matching components.
  const [closedCabinets, setClosedCabinets] = useState<Set<string>>(new Set());
  // Rate Pending tab: a table per group (Carcass, Shutter, Other Panel, Hardware) of the lines that had no rate when the tab opened,
  // numbered by unit (1.1, 1.2 ... 2.1) and edited in place.
  const ratePending = () => {
    const numbered = <T extends { id: string }>(pick: (c: QuoteCabinet) => T[]) =>
      units.flatMap((u, i) => {
        let n = 0;
        return u.cabinets.flatMap((c) => pick(c).map((item) => ({ u, c, item, no: `${i + 1}.${++n}` })));
      }).filter((r) => pendingIds.has(r.item.id));
    const groups = (["carcass", "shutter", "panel"] as const).map((v) => {
      const rows = numbered(FURN[v].pick);
      const values = (r: (typeof rows)[number]) => furnValues(r.item, dimsFor(v, r.u, r.c), r.no);
      return { v, values, rows: arrange(rows, values).filter((r) => passes([r.item.id])) };
    }).filter((g) => g.rows.length > 0);
    const hw = arrange(numbered((c) => c.hardware), (r) => hardwareValues(r.item, r.no, undefined, r.u)).filter((r) => passes([r.item.id]));
    if (groups.length === 0 && hw.length === 0) {
      return <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">{pendingIds.size === 0 ? "Every line has a rate." : "No lines match your search."}</p>;
    }
    const title = (label: string, n: number) => <h4 className="px-1 pb-1 font-heading text-sm font-semibold text-grey-900">{label} <span className="font-number text-xs font-normal text-grey-500">({n})</span></h4>;
    return (
      <div className="quote-dense flex flex-col gap-4">
        {groups.map(({ v, rows, values }) => {
          const def = FURN[v];
          return (
            <div key={v} className="-mx-2 overflow-x-auto">
              <div className="min-w-[1060px]">
                {title({ carcass: "Carcass", shutter: "Shutter", panel: "Other Panel" }[v], rows.length)}
                {withTick(rows.map((r) => r.item.id), `every ${v} line shown`, <FurnitureTableHeader showComponentName showLevelType={def.level} nameLabel={def.label} withNo sort={sort} onSort={onSort} />)}
                <DndContext sensors={sensors} collisionDetection={closestCenter}>
                  <SortableContext items={rows.map((r) => r.item.id)} strategy={verticalListSortingStrategy}>
                    {rows.map((r) => {
                      const { u, c, item, no } = r;
                      const list = def.pick(c);
                      return withTick([item.id], `line ${no}`, (
                        <FurnitureLineItemRow
                          key={item.id}
                          table
                          rowNo={no}
                          value={item}
                          label={def.label}
                          showComponentName
                          showLevelType={def.level}
                          totalSqFt={values(r).sqft}
                          unitDims={dimsFor(v, u, c)}
                          onChange={(patch) => patchCabinet(u.id, c.id, def.put(list.map((x) => (x.id === item.id ? { ...x, ...patch } : x))))}
                          onRemove={() => patchCabinet(u.id, c.id, def.put(list.filter((x) => x.id !== item.id)))}
                        />
                      ), item.id);
                    })}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          );
        })}
        {hw.length > 0 && (
          <div className="-mx-2 overflow-x-auto">
            <div className="min-w-[1060px]">
              {title("Hardware", hw.length)}
              {withTick(hw.map((r) => r.item.id), "every hardware line shown", <HardwareTableHeader withNo sort={sort} onSort={onSort} />)}
              <DndContext sensors={sensors} collisionDetection={closestCenter}>
                <SortableContext items={hw.map((r) => r.item.id)} strategy={verticalListSortingStrategy}>
                  {hw.map(({ u, c, item, no }) => withTick([item.id], `line ${no}`, (
                    <UnitTypeHardwareRow
                      key={item.id}
                      table
                      rowNo={no}
                      value={item}
                      onChange={(patch) => patchCabinet(u.id, c.id, { hardware: c.hardware.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) })}
                      onRemove={() => patchCabinet(u.id, c.id, { hardware: c.hardware.filter((x) => x.id !== item.id) })}
                    />
                  ), item.id))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}
      </div>
    );
  };
  const carcassByCabinet = () => {
    const q = query.trim().toLowerCase();
    let n = 0;
    const cabs = units.flatMap((u) => u.cabinets.map((c) => {
      const no = String(++n);
      const type = cabinetTypes.find((t) => t.id === c.cabinetTypeId);
      const unitText = [nameOf(spaces, u.spaceId ?? ""), unitTypes.find((t) => t.id === u.unitTypeId)?.shortCode].filter(Boolean).join(" · ");
      const dims = dimsFor("carcass", u, c);
      const all = c.components.map((item, k) => ({ u, c, item, no: `${no}.${k + 1}` }));
      const values = (r: (typeof all)[number]) => furnValues(r.item, dims, r.no);
      const headMatch = !q || `${type?.name ?? ""} ${unitText}`.toLowerCase().includes(q);
      const lines = arrange(all, values, !headMatch).filter((r) => passes([r.item.id]));
      const sum = (k: "sqft" | "amount") => all.reduce((t, r) => t + values(r)[k], 0);
      return { u, c, no, type, unitText, dims, lines, values, show: (headMatch && lineFilter === "all") || lines.length > 0, sqft: sum("sqft"), amount: sum("amount"), qty: all.reduce((t, r) => t + r.item.qty, 0) };
    }));
    const shown = cabs.filter((x) => x.show);
    const num = "h-6 w-full bg-card px-1 text-center text-xs font-number [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
    const toggle = (id: string) => setClosedCabinets((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    if (shown.length === 0) return <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">{cabs.length === 0 ? "No cabinets yet. Open a unit and use its Add Cabinet button." : "No lines match your search."}</p>;
    return (
      <div className="quote-dense">
        <div className="-mx-2 overflow-x-auto">
          <div className="min-w-[1100px]">
            {withTick(shown.flatMap((x) => x.lines.map((r) => r.item.id)), "every line shown", (
            <div className="grid items-center gap-x-1.5 bg-[var(--table-head)] px-2 py-1 text-xs font-medium text-grey-900" style={{ gridTemplateColumns: CABINET_ROW }}>
              <span /><span>Sr No</span><span>Cabinet Type</span><span>Unit</span>
              {["Width", "Depth", "Height", "Qty", "Sq.ft"].map((h) => <span key={h} className="text-center">{h}</span>)}
              <span className="text-right">Amount</span><span />
            </div>
            ))}
            {shown.map(({ u, c, no, type, unitText, dims, lines, values, sqft, amount }) => {
              const open = !closedCabinets.has(c.id);
              const size = carcassUnitFor(c, u);
              return (
                <div key={c.id} className="border-b border-grey-100">
                  {withTick(lines.map((r) => r.item.id), `cabinet ${no}`, (
                  <div className="grid items-center gap-x-1.5 bg-card px-2 py-0.5 text-xs" style={{ gridTemplateColumns: CABINET_ROW }}>
                    <button type="button" onClick={() => toggle(c.id)} aria-label={open ? `Collapse cabinet ${no}` : `Expand cabinet ${no}`} className="flex h-6 w-6 items-center justify-center rounded-md border border-grey-100 bg-light-600 text-grey-500 hover:text-grey-800">
                      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <span className="num text-xs font-semibold text-grey-900">{no}</span>
                    <CabinetTypeSelect compact value={c.cabinetTypeId} onChange={(cabinetTypeId) => patchCabinet(u.id, c.id, { cabinetTypeId })} />
                    <span className="truncate text-xs font-body text-grey-700" title={unitText}>{unitText || "—"}</span>
                    {(["carcassWidth", "carcassDepth", "carcassHeight", "carcassQty"] as const).map((k) => (
                      <Input key={k} type="number" min={k === "carcassQty" ? 1 : 0} aria-label={`${k.replace("carcass", "")} of cabinet ${no}`} value={k === "carcassQty" ? size.qty : k === "carcassWidth" ? size.width : k === "carcassDepth" ? size.depth : size.height} onChange={(e) => patchCabinet(u.id, c.id, { [k]: Number(e.target.value) })} className={num} />
                    ))}
                    <span className="num text-center text-xs text-grey-700">{sqft.toFixed(2)}</span>
                    <span className="num text-right text-xs font-semibold text-grey-900">₹{amount.toFixed(2)}</span>
                    <Button type="button" size="icon-sm" aria-label={`Auto Populate cabinet ${no}`} title="Auto Populate" disabled={!type} onClick={() => type && patchCabinet(u.id, c.id, { components: autoPopulateComponents(type, size) })} className="h-6 w-6">
                      <Sparkles className="h-3 w-3" />
                    </Button>
                  </div>
                  ))}
                  {open && (
                    <div className="mb-1.5 ml-7 mr-1 overflow-hidden rounded-md border border-grey-100">
                      {withTick(lines.map((r) => r.item.id), `every line of cabinet ${no}`, <FurnitureTableHeader showComponentName showLevelType={false} nameLabel="Component" withNo sort={sort} onSort={onSort} />)}
                      <DndContext sensors={sensors} collisionDetection={closestCenter}>
                        <SortableContext items={lines.map((r) => r.item.id)} strategy={verticalListSortingStrategy}>
                          {lines.map((r) => withTick([r.item.id], `line ${r.no}`, (
                            <FurnitureLineItemRow
                              key={r.item.id}
                              table
                              rowNo={r.no}
                              value={r.item}
                              label="Component"
                              showComponentName
                              totalSqFt={values(r).sqft}
                              unitDims={dims}
                              onChange={(patch) => patchCabinet(u.id, c.id, { components: c.components.map((x) => (x.id === r.item.id ? { ...x, ...patch } : x)) })}
                              onRemove={() => patchCabinet(u.id, c.id, { components: c.components.filter((x) => x.id !== r.item.id) })}
                              onCopy={() => {
                                const at = c.components.findIndex((x) => x.id === r.item.id);
                                const next = [...c.components];
                                next.splice(at + 1, 0, { ...r.item, id: newId("qli") });
                                patchCabinet(u.id, c.id, { components: next });
                              }}
                            />
                          ), r.item.id))}
                        </SortableContext>
                      </DndContext>
                      {c.components.length === 0 && <p className="px-3 py-2 text-xs font-body text-grey-400">No components yet. Pick the cabinet type and press Auto Populate, or add one.</p>}
                      <div className="border-t border-grey-100 bg-light-600 px-2 py-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => patchCabinet(u.id, c.id, { components: [...c.components, blankLineItem()] })}>
                          <Plus className="h-3.5 w-3.5" /> Add Component
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {withTick([], "", (
            <div className="grid items-center gap-x-1.5 bg-[var(--table-head)] px-2 py-1 text-xs font-semibold text-grey-900" style={{ gridTemplateColumns: CABINET_ROW }}>
              <span style={{ gridColumn: "1 / 8" }}>Total ({shown.length} {shown.length === 1 ? "cabinet" : "cabinets"})</span>
              <span className="num text-center">{shown.reduce((t, x) => t + x.qty, 0)} pcs</span>
              <span className="num text-center">{shown.reduce((t, x) => t + x.sqft, 0).toFixed(2)}</span>
              <span className="num text-right">₹{shown.reduce((t, x) => t + x.amount, 0).toFixed(2)}</span>
              <span />
            </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
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
      {PanelCalculator && calcOpen && (
        <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Panel Calculator</DialogTitle>
              <DialogDescription>Calculate adds the panels to the Other Panel of the unit picked below. Close when you&apos;re done.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label>Add to</Label>
              <SelectField
                value={calcTarget || calcTargets[0]?.key || ""}
                onChange={(e) => setCalcTarget(e.target.value)}
                menuClassName="w-max min-w-72 max-w-[calc(100vw-2rem)]"
                className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
              >
                {calcTargets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </SelectField>
            </div>
            <PanelCalculator onAdd={addCalcLines} />
          </DialogContent>
        </Dialog>
      )}
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
            {([["units", "All Units", units.length], ["carcass", "Carcass", furnCount("carcass")], ["shutter", "Shutter", furnCount("shutter")], ["panel", "Other Panel", furnCount("panel")], ["hardware", "Hardware", hardwareCount], ["merge", "Merge Hardware", merged.length], ["pending", "Rate Pending", pendingCount]] as const).map(([k, label, n]) => (
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
          {/* Requirement Order: All / Pending / Sent lines, and Send to PO once something is ticked. */}
          {send && (
            <div className="flex flex-wrap items-center gap-2">
              {/* The filter is for the line tabs; All Units has a tick per unit. */}
              {view !== "units" && <div className="flex rounded-lg border border-grey-100 p-0.5" role="tablist" aria-label="Lines">
                {(["all", "pending", "sent"] as const).map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={lineFilter === k} onClick={() => setLineFilter(k)} className={`rounded-md px-2.5 py-0.5 text-xs font-body font-medium ${lineFilter === k ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600"}`}>
                    {k === "all" ? "All" : k === "pending" ? "Pending" : "Sent"}
                  </button>
                ))}
              </div>}
              {pickedLive.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-primary-transparent px-2 py-1">
                  <span className="text-xs font-body font-semibold text-grey-900"><span className="font-number">{pickedLive.length}</span> {pickedLive.length === 1 ? "line" : "lines"} ticked</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setPicked(new Set())}>Clear</Button>
                  <Button type="button" size="sm" className="h-6 px-2 text-xs" disabled={!!send.blocked} title={send.blocked} onClick={() => send.onSend(pickedLive)}>
                    <Send className="h-3 w-3" /> Send to PO
                  </Button>
                </div>
              )}
            </div>
          )}
          {PanelCalculator && view === "panel" && calcTargets.length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={() => setCalcOpen(true)}>
              <Calculator className="h-3.5 w-3.5" />
              Calculator
            </Button>
          )}
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
                {withTick(mergedShown.flatMap(({ m }) => [...m.ids]), "every line shown", <HardwareTableHeader withNo sort={sort} onSort={onSort} />)}
                <DndContext sensors={sensors} collisionDetection={closestCenter}>
                  <SortableContext items={mergedShown.map(({ m }) => m.item.id)} strategy={verticalListSortingStrategy}>
                    {mergedShown.map(({ m, i }) => withTick([...m.ids], `merged line ${i + 1}`, (
                      <UnitTypeHardwareRow
                        key={m.item.id}
                        table
                        rowNo={String(i + 1)}
                        // The merged line shows the total quantity; the first line behind it supplies the other details.
                        value={{ ...m.item, qtyFormula: String(m.qty) }}
                        onChange={(patch) => editMerged(m, patch)}
                        onRemove={() => removeMerged(m)}
                      />
                    ), m.item.id))}
                  </SortableContext>
                </DndContext>
                {withTick([], "", (
                <div className="flex justify-between border-t border-grey-100 bg-primary-transparent px-3 py-1.5 text-[11px] font-body font-semibold text-grey-900">
                  <span>Total ({merged.reduce((t, m) => t + m.lines, 0)} lines merged into {merged.length})</span>
                  <span className="[font-family:var(--font-manrope)]">{formatInr(merged.reduce((t, m) => t + m.amount, 0))}</span>
                </div>
                ))}
              </div>
            </div>
          </div>
        )
      ) : bare && view === "pending" && units.length > 0 ? (
        ratePending()
      ) : bare && view === "carcass" && units.length > 0 ? (
        carcassByCabinet()
      ) : bare && view !== "units" && units.length > 0 ? (
        <div className="quote-dense">
          {(() => {
            // One table of every line of the group (or hardware) in the quote, numbered by unit: 1.1, 1.2, 1.3 ... then 2.1 ...
            const numbered = <T,>(pick: (c: QuoteCabinet) => T[]) =>
              units.flatMap((u, i) => {
                let n = 0;
                return u.cabinets.flatMap((c) => pick(c).map((item) => ({ u, c, item, no: `${i + 1}.${++n}` })));
              });
            const furnRows = furn ? numbered(furn.pick) : [];
            const hardwareRows = view === "hardware" ? numbered((c) => c.hardware) : [];
            const rows = [...furnRows, ...hardwareRows];
            const fv = (r: (typeof furnRows)[number]) => furnValues(r.item, dimsFor(view as FurnView, r.u, r.c), r.no);
            const shownShutter = arrange(furnRows, fv).filter((r) => passes([r.item.id]));
            const shownHardware = arrange(hardwareRows, (r) => hardwareValues(r.item, r.no, undefined, r.u)).filter((r) => passes([r.item.id]));
            const shownIds = [...shownShutter, ...shownHardware].map((r) => r.item.id);
            if (rows.length === 0) {
              return (
                <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">
                  No {{ carcass: "carcass", shutter: "shutter", panel: "other panel", hardware: "hardware" }[view as string]} lines yet. Open a unit and use its {{ carcass: "Add Component", shutter: "Add Shutter", panel: "Other Panel", hardware: "Add Hardware" }[view as string]} button.
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
                  {withTick(shownIds, "every line shown", furn ? <FurnitureTableHeader showComponentName showLevelType={furn.level} nameLabel={furn.label} withNo sort={sort} onSort={onSort} /> : <HardwareTableHeader withNo sort={sort} onSort={onSort} />)}
                  {/* Dragging is off here (the number takes the handle's place); rows are reordered inside their unit. */}
                  <DndContext sensors={sensors} collisionDetection={closestCenter}>
                    <SortableContext items={[...shownShutter, ...shownHardware].map((r) => r.item.id)} strategy={verticalListSortingStrategy}>
                      {furn && shownShutter.map((r) => {
                          const { u, c, item, no } = r;
                          const list = furn.pick(c);
                          const dims = dimsFor(view as FurnView, u, c);
                          return withTick([item.id], `line ${no}`, (
                          <FurnitureLineItemRow
                            key={item.id}
                            table
                            rowNo={no}
                            value={item}
                            label={furn.label}
                            showComponentName
                            showLevelType={furn.level}
                            totalSqFt={fv(r).sqft}
                            unitDims={dims}
                            onChange={(patch) => patchCabinet(u.id, c.id, furn.put(list.map((x) => (x.id === item.id ? { ...x, ...patch } : x))))}
                            onRemove={() => patchCabinet(u.id, c.id, furn.put(list.filter((x) => x.id !== item.id)))}
                            onCopy={() => {
                              const at = list.findIndex((x) => x.id === item.id);
                              const next = [...list];
                              next.splice(at + 1, 0, { ...item, id: newId("qli") });
                              patchCabinet(u.id, c.id, furn.put(next));
                            }}
                          />
                          ), item.id);
                        })}
                      {shownHardware.map(({ u, c, item, no }) => withTick([item.id], `line ${no}`, (
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
                      ), item.id))}
                    </SortableContext>
                  </DndContext>
                  {/* Hardware: the amount total of the lines listed above, under the Amount column. */}
                  {view === "hardware" && shownHardware.length > 0 && withTick([], "", (
                    <div className="grid items-center gap-x-1.5 border-t border-grey-100 bg-[var(--table-head)] px-2 py-1.5 text-sm font-semibold text-grey-900" style={{ gridTemplateColumns: HARDWARE_TABLE_COLUMNS.replace("20px", "44px") }}>
                      <span style={{ gridColumn: "1 / 10" }}>Total ({shownHardware.length} lines)</span>
                      <span className="num text-right">₹{shownHardware.reduce((n, r) => n + hardwareValues(r.item, r.no, undefined, r.u).amount, 0).toFixed(2)}</span>
                      <span />
                    </div>
                  ))}
                  {/* Carcass / Shutter / Other Panel: the totals of the lines listed above, under their own columns (Qty, Sq.ft and Amount). */}
                  {furn && shownShutter.length > 0 && withTick([], "", (
                    <div className="grid items-center gap-x-1.5 border-t border-grey-100 bg-[var(--table-head)] px-2 py-1.5 text-sm font-semibold text-grey-900" style={{ gridTemplateColumns: furnitureTableColumns(true, furn.level, true) }}>
                      <span style={{ gridColumn: "1 / 5" }}>Total</span>
                      <span className="num text-center">{shownShutter.reduce((n, r) => n + r.item.qty, 0)}</span>
                      <span />
                      <span className="num text-center">{shownShutter.reduce((n, r) => n + fv(r).sqft, 0).toFixed(2)}</span>
                      <span style={{ gridColumn: "8 / 12" }} />
                      <span className="num text-right">₹{shownShutter.reduce((n, r) => n + fv(r).amount, 0).toFixed(2)}</span>
                      {furn.level && <span />}
                      <span />
                    </div>
                  ))}
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
                <div className={cn(send ? UNIT_ROW_GRID_TICK : UNIT_ROW_GRID, "unit-top unit-head bg-[var(--table-head)] px-2 py-1 text-xs font-body font-medium text-grey-900")}>
                  {send ? (
                    <>
                      {/* Send to PO: a tick for every unit shown, in line with the units' own ticks (after the drag handle's width). */}
                      <span className="flex items-center gap-0.5">
                        <span className="w-5 shrink-0" />
                        {tickInput(shownUnits.flatMap(({ unit }) => unit.cabinets.flatMap((c) => [...c.components, ...c.externalFinishes, ...c.panels, ...c.hardware].map((x) => x.id))).filter((id) => send.sendable.has(id)), "every unit shown")}
                      </span>
                      <span className="col-span-2" />
                    </>
                  ) : (
                    <span className="col-span-3" />
                  )}
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
                    // Send to PO: one tick for every line of the unit that can still go to a PO (right after the drag handle).
                    tick={send ? tickInput(unit.cabinets.flatMap((c) => [...c.components, ...c.externalFinishes, ...c.panels, ...c.hardware].map((x) => x.id)).filter((id) => send.sendable.has(id)), `unit ${index + 1}`) : undefined}
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
