import type { MaterialItem } from "@/lib/mock/material-spec";
import type { HardwarePriceItem, PurchaseFurniturePriceItem } from "@/lib/mock/pricing-list";
import type { PurchaseOrderLine } from "@/lib/purchase-order";

const norm = (s: string) => s.trim().toLowerCase();

// Rate from the Purchase Furniture Price List when a panel row's thickness, raw material and internal / external
// brand & colour all match one price row. null = no match (hardware never matches).
// With a vendor picked, only that vendor's rows (or rows with no vendor) count, the vendor's own row first.
export function purchaseRateFor(l: PurchaseOrderLine, prices: PurchaseFurniturePriceItem[], materials: MaterialItem[], vendorId = ""): number | null {
  if (l.group === "hardware") return null;
  const m = new Map(materials.map((x) => [x.id, x]));
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
  const hit = vendorId
    ? prices.find((p) => p.vendorId === vendorId && ok(p)) ?? prices.find((p) => !p.vendorId && ok(p))
    : prices.find(ok);
  return hit ? hit.rate : null;
}

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

// The Purchase Furniture Price List fields for a panel row (ids from Material Library), "" where nothing matches.
export function purchasePriceFieldsFor(l: PurchaseOrderLine, materials: MaterialItem[]) {
  const find = (cat: string, ok: (m: MaterialItem) => boolean) => materials.find((m) => !m.deleted && m.category === cat && ok(m))?.id ?? "";
  const finish = (m: MaterialItem) => `${m.description} — ${m.name}`;
  return {
    thicknessId: find("thickness", (m) => parseFloat(m.name) === l.depth),
    rawMaterialTypeId: find("raw-material-type", (m) => norm(m.name) === norm(l.material)),
    internalColourId: find("purchase-internal", (m) => norm(finish(m)) === norm(l.internalColour)),
    externalColourId: find("purchase-external", (m) => norm(finish(m)) === norm(l.externalColour)),
  };
}

// Fill rates on rows whose matching fields changed (or that have no rate yet). A rate typed by hand on a row whose
// fields didn't change is kept. Panels: rate from the Purchase Furniture Price List. Hardware: rate = MRP and
// discount % from the Hardware Price List. `vendorChanged`: every panel row is re-rated for the new vendor, and a row
// with no price for that vendor goes to 0 (shown highlighted) instead of keeping the old vendor's rate.
// `vendorId` may be a function giving each row's vendor (a cabinet can have its own).
export function applyPurchaseRates(next: PurchaseOrderLine[], prev: PurchaseOrderLine[], prices: PurchaseFurniturePriceItem[], materials: MaterialItem[], hardware: HardwarePriceItem[] = [], vendorId: string | ((l: PurchaseOrderLine) => string) = "", vendorChanged = false) {
  const vendorOf = (l: PurchaseOrderLine) => (typeof vendorId === "string" ? vendorId : vendorId(l));
  const before = new Map(prev.map((l) => [l.id, l]));
  const sig = (l: PurchaseOrderLine) =>
    (l.group === "hardware" ? [l.category, l.brand, l.description, l.unit] : [l.depth, l.material, l.internalColour, l.externalColour]).join("|");
  return next.map((l) => {
    const old = before.get(l.id);
    // The PO's vendor changed: rows without a vendor of their own follow it; a row's own vendor (and its hand-typed rate) stays.
    if (vendorChanged && l.group !== "hardware" && !l.vendorId) return { ...l, rate: purchaseRateFor(l, prices, materials, vendorOf(l)) ?? 0 };
    // A row given its own vendor (or taken back to the cabinet's) is re-rated for it; no price there → 0, highlighted.
    if (l.group !== "hardware" && old && (old.vendorId ?? "") !== (l.vendorId ?? "")) return { ...l, rate: purchaseRateFor(l, prices, materials, vendorOf(l)) ?? 0 };
    if (l.rate !== 0 && old && sig(old) === sig(l)) return l;
    if (l.group === "hardware") {
      const h = hardwareMatchFor(l, hardware, materials);
      return h ? { ...l, rate: h.mrp, discountPct: h.discountPct } : l;
    }
    const rate = purchaseRateFor(l, prices, materials, vendorOf(l));
    return rate === null ? l : { ...l, rate };
  });
}
