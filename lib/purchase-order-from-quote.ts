import type { Quote, QuoteCabinet } from "@/lib/mock/quote";
import type { MaterialItem } from "@/lib/mock/material-spec";
import type { HardwarePriceItem } from "@/lib/mock/pricing-list";
import type { UnitType, FurnitureLineItem } from "@/lib/mock/unit-type";
import type { CabinetType } from "@/lib/mock/cabinet-type";
import { carcassUnitFor, evaluateFormula } from "@/lib/quote-pricing";
import { panelSqft, type PoCabinet, type PoGroup, type PoMaterial, type PurchaseOrderLine } from "@/lib/purchase-order";

export type PoLineDraft = Omit<PurchaseOrderLine, "id">;

type Ctx = { materials: MaterialItem[]; unitTypes: UnitType[]; hardwareItems: HardwarePriceItem[] };

const unitQty = (u: { qty: number }) => Math.max(1, u.qty || 1);

// Snapshot of a quote's cut-list as PO lines (one row per panel, grouped
// A Carcass / B Shutter / C Other Panel / D Hardware). Each row already holds
// mm dimensions baked from the formulas. Row qty is multiplied by the unit's qty
// (same as the quote's own totals: unitTotal/unitSqFt scale by unit qty), so a
// PO always agrees with the quote. Rate is left at 0 — typed manually.
// srNo = running cabinet number in quote order; the Design column starts blank (typed by hand,
// not copied from the quote's unit codes). Each cabinet's name and W/D/H are
// kept in material.cabinets (keyed by srNo) so the PO can show a header per cabinet
// like the quote does. Purchase internal/external finishes start blank — they are
// picked from the Purchase Material Library, not copied from the quote's sales colours.
export function buildPoFromQuote(quote: Quote, { materials, unitTypes, hardwareItems }: Ctx): { material: PoMaterial; lines: PoLineDraft[] } {
  const name = (id?: string) => (id ? materials.find((m) => m.id === id)?.name ?? "" : "");
  const thickness = (id?: string) => parseFloat(name(id)) || 0;

  // Per-cabinet sr no, in quote order.
  const cabinets: { cabinet: QuoteCabinet; unit: Quote["units"][number]; srNo: number }[] = [];
  let sr = 0;
  for (const unit of quote.units) for (const cabinet of unit.cabinets) cabinets.push({ cabinet, unit, srNo: ++sr });

  const lines: PoLineDraft[] = [];
  const panelRow = (group: PoGroup, item: FurnitureLineItem, dims: { width: number; depth: number; height: number }, c: (typeof cabinets)[number], fallback: string) => {
    const vars = { W: dims.width, D: dims.depth, H: dims.height };
    const qty = item.qty * unitQty(c.unit);
    const width = Math.round(evaluateFormula(item.widthFormula, vars));
    const height = Math.round(evaluateFormula(item.heightFormula, vars));
    if (!width || !height) return; // an empty row has nothing to cut
    lines.push({
      group,
      srNo: c.srNo,
      position: lines.length,
      description: name(item.componentTypeId) || fallback,
      designType: "",
      width,
      depth: thickness(item.thicknessId),
      height,
      qty,
      sqft: panelSqft(width, height, qty),
      internalColour: "",
      externalColour: "",
      material: name(item.rawMaterialTypeId),
      articleNo: "",
      brand: "",
      category: "",
      unit: "",
      rate: 0,
      remarks: "",
    });
  };

  for (const c of cabinets) for (const i of c.cabinet.components) panelRow("carcass", i, carcassUnitFor(c.cabinet, c.unit), c, "Carcass");
  for (const c of cabinets) for (const i of c.cabinet.externalFinishes) panelRow("shutter", i, c.unit, c, "Shutter");
  for (const c of cabinets) for (const i of c.cabinet.panels) panelRow("other-panel", i, c.unit, c, "Panel");
  for (const c of cabinets) {
    for (const h of c.cabinet.hardware) {
      const matched = hardwareItems.find((x) => x.id === h.hardwareItemId);
      const qty = Math.round(evaluateFormula(h.qtyFormula, { W: c.unit.width, D: c.unit.depth, H: c.unit.height })) * unitQty(c.unit);
      if (!qty) continue;
      lines.push({
        group: "hardware",
        srNo: c.srNo,
        position: lines.length,
        description: h.description ?? matched?.description ?? "",
        designType: "",
        width: 0,
        depth: 0,
        height: 0,
        qty,
        sqft: 0,
        internalColour: "",
        externalColour: "",
        material: "",
        articleNo: h.articleNo ?? matched?.articleNo ?? "",
        brand: name(h.brandId ?? matched?.brandId),
        category: name(h.categoryId),
        unit: name(matched?.unitId),
        rate: 0,
        remarks: "",
      });
    }
  }

  const cabinetInfo: Record<string, PoCabinet> = {};
  for (const c of cabinets) {
    const dims = carcassUnitFor(c.cabinet, c.unit);
    cabinetInfo[String(c.srNo)] = {
      label: c.cabinet.label,
      unitName: unitTypes.find((u) => u.id === c.unit.unitTypeId)?.name ?? "",
      space: name(c.unit.spaceId),
      width: dims.width,
      depth: dims.depth,
      height: dims.height,
      qty: dims.qty,
      cabinetTypeId: c.cabinet.cabinetTypeId,
      unitQty: unitQty(c.unit),
    };
  }

  const distinct = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const shutters = lines.filter((l) => l.group === "shutter");
  const others = lines.filter((l) => l.group !== "shutter" && l.group !== "hardware");
  const material: PoMaterial = {
    cabinetRawMaterial: "",
    cabinetOtherRawMaterial: "",
    shutterRawMaterial: name(quote.shutterFinishRawMaterialId) || distinct(shutters.map((l) => l.material))[0] || "",
    otherRawMaterial: distinct(others.map((l) => l.material))[0] ?? "",
    internalColours: [],
    externalColours: [],
    cabinets: cabinetInfo,
  };
  return { material, lines };
}

// Cabinet-level Auto Populate: recalculate the sizes of this cabinet's EXISTING carcass rows for the cabinet's
// current W/D/H/Qty, using the cabinet type's width/height formulas (the quote's rule). Each row is matched to a
// cabinet-type component by name (nth occurrence). Rows are never added or removed — a component the PO doesn't
// have is not added, and a row with no matching component keeps its size — and everything typed on a row
// (rate, remarks, finishes, material, thickness) is kept; only width, height, qty and sq.ft change.
export function recalcCarcass({
  cabinetType,
  cabinet,
  lines,
  materials,
}: {
  cabinetType: CabinetType;
  cabinet: PoCabinet;
  lines: PurchaseOrderLine[]; // this cabinet's carcass rows
  materials: MaterialItem[];
}): { lines: PurchaseOrderLine[]; recalculated: number } {
  const name = (id?: string) => (id ? materials.find((m) => m.id === id)?.name ?? "" : "");
  const vars = { W: cabinet.width, D: cabinet.depth, H: cabinet.height };
  const seen = new Map<string, number>();
  let recalculated = 0;
  const out = lines.map((l) => {
    const nth = seen.get(l.description) ?? 0;
    seen.set(l.description, nth + 1);
    const comp = cabinetType.components.filter((c) => (name(c.componentTypeId) || "Carcass") === l.description)[nth];
    if (!comp) return l;
    const width = Math.round(evaluateFormula(comp.widthFormula, vars));
    const height = Math.round(evaluateFormula(comp.heightFormula, vars));
    if (!width || !height) return l;
    const qty = comp.qty * Math.max(1, cabinet.qty) * Math.max(1, cabinet.unitQty);
    recalculated++;
    return { ...l, width, height, qty, sqft: panelSqft(width, height, qty) };
  });
  return { lines: out, recalculated };
}

// Older POs were saved before each cabinet remembered its cabinet type and unit qty (needed by Auto Populate).
// Cabinet numbers follow the quote's order, so they can be read back from the quote.
export function quoteCabinetInfo(quote: Quote): Map<number, { cabinetTypeId: string; unitQty: number }> {
  const out = new Map<number, { cabinetTypeId: string; unitQty: number }>();
  let sr = 0;
  for (const unit of quote.units) for (const cabinet of unit.cabinets) out.set(++sr, { cabinetTypeId: cabinet.cabinetTypeId, unitQty: unitQty(unit) });
  return out;
}
