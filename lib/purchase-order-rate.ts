import type { MaterialItem } from "@/lib/mock/material-spec";
import type { HardwarePriceItem, PurchaseFurniturePriceItem } from "@/lib/mock/pricing-list";
import type { PurchaseOrderLine } from "@/lib/purchase-order";

const norm = (s: string) => s.trim().toLowerCase();

// Rate from the Purchase Furniture Price List when a panel row's thickness, raw material and internal / external
// brand & colour all match one price row. null = no match (hardware never matches).
export function purchaseRateFor(l: PurchaseOrderLine, prices: PurchaseFurniturePriceItem[], materials: MaterialItem[]): number | null {
  if (l.group === "hardware") return null;
  const m = new Map(materials.map((x) => [x.id, x]));
  // Vendor on a price row is for reference only; it doesn't affect matching.
  const ok = (p: PurchaseFurniturePriceItem) => {
    if (p.deleted) return false;
    const thk = m.get(p.thicknessId), raw = m.get(p.rawMaterialTypeId), int = m.get(p.internalColourId), ext = m.get(p.externalColourId);
    return (
      !!thk && !!raw && !!int && !!ext &&
      parseFloat(thk.name) === l.depth &&
      norm(raw.name) === norm(l.material) &&
      norm(`${int.description} — ${int.name}`) === norm(l.internalColour) &&
      norm(`${ext.description} — ${ext.name}`) === norm(l.externalColour)
    );
  };
  const hit = prices.find(ok);
  return hit ? hit.rate : null;
}

// Fill rates on rows whose matching fields changed (or that have no rate yet). A rate typed by hand on a row whose
// fields didn't change is kept.
// Hardware row → Hardware Price List item when category, brand, description and unit all match.
export function hardwareMatchFor(l: PurchaseOrderLine, hardware: HardwarePriceItem[], materials: MaterialItem[]): HardwarePriceItem | null {
  if (l.group !== "hardware") return null;
  const name = new Map(materials.map((x) => [x.id, x.name]));
  return (
    hardware.find(
      (h) =>
        !h.deleted &&
        norm(name.get(h.categoryId) ?? "") === norm(l.category) &&
        norm(name.get(h.brandId) ?? "") === norm(l.brand) &&
        norm(h.description) === norm(l.description) &&
        norm(name.get(h.unitId) ?? "") === norm(l.unit)
    ) ?? null
  );
}

// Fill rates on rows whose matching fields changed (or that have no rate yet). A rate typed by hand on a row whose
// fields didn't change is kept. Panels: rate from the Purchase Furniture Price List. Hardware: rate = MRP and
// discount % from the Hardware Price List.
export function applyPurchaseRates(next: PurchaseOrderLine[], prev: PurchaseOrderLine[], prices: PurchaseFurniturePriceItem[], materials: MaterialItem[], hardware: HardwarePriceItem[] = []) {
  const before = new Map(prev.map((l) => [l.id, l]));
  const sig = (l: PurchaseOrderLine) =>
    (l.group === "hardware" ? [l.category, l.brand, l.description, l.unit] : [l.depth, l.material, l.internalColour, l.externalColour]).join("|");
  return next.map((l) => {
    const old = before.get(l.id);
    if (l.rate !== 0 && old && sig(old) === sig(l)) return l;
    if (l.group === "hardware") {
      const h = hardwareMatchFor(l, hardware, materials);
      return h ? { ...l, rate: h.mrp, discountPct: h.discountPct } : l;
    }
    const rate = purchaseRateFor(l, prices, materials);
    return rate === null ? l : { ...l, rate };
  });
}
