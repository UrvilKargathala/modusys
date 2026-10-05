import type { Quote, QuoteCabinet } from "@/lib/mock/quote";
import type { MaterialItem } from "@/lib/mock/material-spec";
import type { HardwarePriceItem } from "@/lib/mock/pricing-list";
import type { UnitType, FurnitureLineItem } from "@/lib/mock/unit-type";
import { carcassUnitFor, evaluateFormula } from "@/lib/quote-pricing";
import { panelSqft, type PoGroup, type PoMaterial, type PurchaseOrderLine } from "@/lib/purchase-order";

export type PoLineDraft = Omit<PurchaseOrderLine, "id">;

type Ctx = { materials: MaterialItem[]; unitTypes: UnitType[]; hardwareItems: HardwarePriceItem[] };

const pad2 = (n: number) => String(n).padStart(2, "0");

// Snapshot of a quote's cut-list as PO lines (one row per panel, grouped
// A Carcass / B Shutter / C Other Panel / D Hardware). Each row already holds
// mm dimensions baked from the formulas and a qty that includes the unit's qty,
// so the row's own qty is used as-is. Rate is left at 0 — typed manually.
// srNo = running cabinet number in quote order; designType = unit type short
// code + running number per code (one per unit).
export function buildPoFromQuote(quote: Quote, { materials, unitTypes, hardwareItems }: Ctx): { material: PoMaterial; lines: PoLineDraft[] } {
  const name = (id?: string) => (id ? materials.find((m) => m.id === id)?.name ?? "" : "");
  const thickness = (id?: string) => parseFloat(name(id)) || 0;

  // Per-cabinet sr no and per-unit design code, computed once in quote order.
  const codeCount = new Map<string, number>();
  const cabinets: { cabinet: QuoteCabinet; unit: Quote["units"][number]; srNo: number; designType: string }[] = [];
  let sr = 0;
  for (const unit of quote.units) {
    const code = unitTypes.find((u) => u.id === unit.unitTypeId)?.shortCode ?? "";
    let designType = "";
    if (code) {
      const n = (codeCount.get(code) ?? 0) + 1;
      codeCount.set(code, n);
      designType = `${code}-${pad2(n)}`;
    }
    for (const cabinet of unit.cabinets) cabinets.push({ cabinet, unit, srNo: ++sr, designType });
  }

  const lines: PoLineDraft[] = [];
  const panelRow = (group: PoGroup, item: FurnitureLineItem, dims: { width: number; depth: number; height: number }, c: (typeof cabinets)[number], fallback: string) => {
    const vars = { W: dims.width, D: dims.depth, H: dims.height };
    const width = Math.round(evaluateFormula(item.widthFormula, vars));
    const height = Math.round(evaluateFormula(item.heightFormula, vars));
    if (!width || !height) return; // an empty row has nothing to cut
    lines.push({
      group,
      srNo: c.srNo,
      position: lines.length,
      description: name(item.componentTypeId) || fallback,
      designType: c.designType,
      width,
      depth: thickness(item.thicknessId),
      height,
      qty: item.qty,
      sqft: panelSqft(width, height, item.qty),
      internalColour: name(item.internalColourId),
      externalColour: name(item.externalColourId),
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
      const qty = Math.round(evaluateFormula(h.qtyFormula, { W: c.unit.width, D: c.unit.depth, H: c.unit.height }));
      if (!qty) continue;
      lines.push({
        group: "hardware",
        srNo: c.srNo,
        position: lines.length,
        description: h.description ?? matched?.description ?? "",
        designType: c.designType,
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

  const distinct = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const shutters = lines.filter((l) => l.group === "shutter");
  const others = lines.filter((l) => l.group !== "shutter" && l.group !== "hardware");
  const material: PoMaterial = {
    shutterRawMaterial: name(quote.shutterFinishRawMaterialId) || distinct(shutters.map((l) => l.material))[0] || "",
    otherRawMaterial: distinct(others.map((l) => l.material))[0] ?? "",
    internalColours: distinct(lines.map((l) => l.internalColour)),
    externalColours: distinct(lines.map((l) => l.externalColour)),
  };
  return { material, lines };
}
