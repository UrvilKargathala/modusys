import type { MaterialItem } from "@/lib/mock/material-spec";
import type { PurchaseFurniturePriceItem } from "@/lib/mock/pricing-list";
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
export function applyPurchaseRates(next: PurchaseOrderLine[], prev: PurchaseOrderLine[], prices: PurchaseFurniturePriceItem[], materials: MaterialItem[]) {
  const before = new Map(prev.map((l) => [l.id, l]));
  const sig = (l: PurchaseOrderLine) => [l.depth, l.material, l.internalColour, l.externalColour].join("|");
  return next.map((l) => {
    const old = before.get(l.id);
    if (l.rate !== 0 && old && sig(old) === sig(l)) return l;
    const rate = purchaseRateFor(l, prices, materials);
    return rate === null ? l : { ...l, rate };
  });
}
