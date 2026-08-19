import type { FurnitureLineItem, UnitTypeHardware } from "@/lib/mock/unit-type";
import type { FurniturePriceItem, HardwarePriceItem } from "@/lib/mock/pricing-list";
import { rateAfterDiscount } from "@/lib/mock/pricing-list";
import type { QuoteCabinet, QuoteUnit } from "@/lib/mock/quote";

export const SQMM_PER_SQFT = 92_903.04;

// The Material Specification section's Shutter Finish selection is the
// single source of truth for every Shutter (External Finish) row's External
// Colour across every Unit/Cabinet — changing it re-syncs all of them
// immediately, rather than each Shutter row picking its own colour.
export type ShutterFinishOverrides = {
  shutterFinishId?: string;
  shutterFinishThicknessId?: string;
  shutterFinishRawMaterialId?: string;
  shutterFinishInternalColourId?: string;
  shutterFinishExternalColourId?: string;
};

export function applyShutterFinishToUnits(units: QuoteUnit[], overrides: ShutterFinishOverrides): QuoteUnit[] {
  return units.map((unit) => ({
    ...unit,
    cabinets: unit.cabinets.map((cabinet) => ({
      ...cabinet,
      externalFinishes: cabinet.externalFinishes.map((item) => ({
        ...item,
        ...(overrides.shutterFinishThicknessId && { thicknessId: overrides.shutterFinishThicknessId }),
        ...(overrides.shutterFinishRawMaterialId && { rawMaterialTypeId: overrides.shutterFinishRawMaterialId }),
        ...(overrides.shutterFinishInternalColourId && { internalColourId: overrides.shutterFinishInternalColourId }),
        ...((overrides.shutterFinishExternalColourId || overrides.shutterFinishId) && {
          externalColourId: overrides.shutterFinishExternalColourId || overrides.shutterFinishId,
        }),
      })),
    })),
  }));
}

// Formulas only ever reference W/D/H plus +-*/() and numbers (see
// furniture-line-item-row.tsx placeholders: "(W-95)/2", "H-20") — never
// arbitrary code, so a whitelist-filtered `Function` eval is safe.
export function evaluateFormula(formula: string, vars: { W: number; D: number; H: number }): number {
  const trimmed = formula.trim().toUpperCase();
  if (!trimmed) return 0;
  if (!/^[\d\s+\-*/().WDH]+$/.test(trimmed)) return 0;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("W", "D", "H", `return (${trimmed});`);
    const result = fn(vars.W, vars.D, vars.H);
    return typeof result === "number" && Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

// Auto Populate bakes the Unit Type's generic formula (e.g. "W-36") into the
// concrete number for *this* quote's Unit dimensions ("564"), so the admin
// sees and edits real millimetres, not the template's symbolic formula. Qty
// gets baked in the same way, multiplied by the Unit's own Qty (e.g. a
// component templated at qty 2, on a Unit set to Qty 3, becomes qty 6) —
// so the per-row Qty already reflects how many physical units this quote
// line represents, and downstream totals never multiply by Unit Qty again.
export function resolveLineItemDimensions<T extends { widthFormula: string; heightFormula: string; qty: number }>(
  item: T,
  unit: { width: number; depth: number; height: number; qty: number }
): T {
  const vars = { W: unit.width, D: unit.depth, H: unit.height };
  return {
    ...item,
    widthFormula: String(Math.round(evaluateFormula(item.widthFormula, vars))),
    heightFormula: String(Math.round(evaluateFormula(item.heightFormula, vars))),
    qty: item.qty * unit.qty,
  };
}

// Same idea for Hardware — qtyFormula (a number or W/D/H formula) gets
// evaluated and multiplied by the Unit's Qty into one concrete number.
export function resolveHardwareForUnit(
  item: UnitTypeHardware,
  unit: { width: number; depth: number; height: number; qty: number }
): UnitTypeHardware {
  const vars = { W: unit.width, D: unit.depth, H: unit.height };
  const resolvedQty = evaluateFormula(item.qtyFormula, vars) * unit.qty;
  return { ...item, qtyFormula: String(Math.round(resolvedQty)) };
}

export function findFurnitureMatch(item: FurnitureLineItem, furnitureItems: FurniturePriceItem[]): FurniturePriceItem | null {
  if (!item.thicknessId || !item.rawMaterialTypeId || !item.internalColourId || !item.externalColourId) return null;
  return (
    furnitureItems.find(
      (i) =>
        i.thicknessId === item.thicknessId &&
        i.rawMaterialTypeId === item.rawMaterialTypeId &&
        i.internalColourId === item.internalColourId &&
        i.externalColourId === item.externalColourId
    ) ?? null
  );
}

// Manual Rate override wins over the price-list lookup wherever a Rate is
// used for pricing — row display, group subtotal, and quote-level totals
// all funnel through here so they never disagree.
export function effectiveFurnitureRate(item: FurnitureLineItem, furnitureItems: FurniturePriceItem[]): number | undefined {
  if (item.rateOverride !== undefined) return item.rateOverride;
  return findFurnitureMatch(item, furnitureItems)?.rate;
}

export function effectiveHardwareRate(item: UnitTypeHardware, hardwareItems: HardwarePriceItem[]): number | undefined {
  if (item.rateOverride !== undefined) return item.rateOverride;
  const matched = hardwareItems.find((h) => h.id === item.hardwareItemId);
  return matched ? rateAfterDiscount(matched) : undefined;
}

export function furnitureLineTotal(
  item: FurnitureLineItem,
  unit: { width: number; depth: number; height: number },
  furnitureItems: FurniturePriceItem[]
): number {
  const rate = effectiveFurnitureRate(item, furnitureItems);
  if (rate === undefined) return 0;
  const w = evaluateFormula(item.widthFormula, { W: unit.width, D: unit.depth, H: unit.height });
  const h = evaluateFormula(item.heightFormula, { W: unit.width, D: unit.depth, H: unit.height });
  const areaSqFt = (w * h) / SQMM_PER_SQFT;
  return rate * areaSqFt * item.qty;
}

export function hardwareLineTotal(
  item: UnitTypeHardware,
  unit: { width: number; depth: number; height: number },
  hardwareItems: HardwarePriceItem[]
): number {
  const rate = effectiveHardwareRate(item, hardwareItems);
  if (rate === undefined) return 0;
  const qty = evaluateFormula(item.qtyFormula, { W: unit.width, D: unit.depth, H: unit.height });
  return rate * qty;
}

export function groupTotal(
  items: FurnitureLineItem[],
  unit: { width: number; depth: number; height: number },
  furnitureItems: FurniturePriceItem[]
): number {
  return items.reduce((sum, i) => sum + furnitureLineTotal(i, unit, furnitureItems), 0);
}

// Carcass reads its own W/D/H/Qty override when set, falling back to the
// Unit's — Shutter/Other Panel/Hardware always use the Unit's directly, so
// editing Carcass dimensions never resizes them.
export function carcassUnitFor(
  cabinet: QuoteCabinet,
  unit: { width: number; depth: number; height: number; qty: number }
): { width: number; depth: number; height: number; qty: number } {
  return {
    width: cabinet.carcassWidth ?? unit.width,
    depth: cabinet.carcassDepth ?? unit.depth,
    height: cabinet.carcassHeight ?? unit.height,
    qty: cabinet.carcassQty ?? unit.qty,
  };
}

export function cabinetTotal(
  cabinet: QuoteCabinet,
  unit: { width: number; depth: number; height: number; qty: number },
  furnitureItems: FurniturePriceItem[],
  hardwareItems: HardwarePriceItem[]
): number {
  const carcassUnit = carcassUnitFor(cabinet, unit);
  return (
    groupTotal(cabinet.components, carcassUnit, furnitureItems) +
    groupTotal(cabinet.externalFinishes, unit, furnitureItems) +
    groupTotal(cabinet.panels, unit, furnitureItems) +
    cabinet.hardware.reduce((sum, h) => sum + hardwareLineTotal(h, unit, hardwareItems), 0)
  );
}

export function unitTotal(
  unit: QuoteUnit,
  furnitureItems: FurniturePriceItem[],
  hardwareItems: HardwarePriceItem[]
): number {
  const perUnit = unit.cabinets.reduce((sum, c) => sum + cabinetTotal(c, unit, furnitureItems, hardwareItems), 0);
  // A unit's Qty means "this many identical units in the quote", so its
  // cost has to scale by qty for the raw total to match Combined Total.
  return perUnit * Math.max(1, unit.qty || 1);
}

export function quoteRawTotal(
  units: QuoteUnit[],
  furnitureItems: FurniturePriceItem[],
  hardwareItems: HardwarePriceItem[]
): number {
  return units.reduce((sum, u) => sum + unitTotal(u, furnitureItems, hardwareItems), 0);
}

// Markup applies to raw cost first, Special Discount applies on the marked-up
// figure — confirmed against business logic before building (not the other
// order).
export function quoteWaterfall(
  rawTotal: number,
  markupMultiplier: number,
  specialDiscountPct: number,
  installationFreightIncluded: boolean,
  installationFreightCost: number = 0
) {
  const markedUp = rawTotal * markupMultiplier;
  const discount = markedUp * (specialDiscountPct / 100);
  const afterDiscount = markedUp - discount;
  // When "Included", cost is baked into the marked-up figure so nothing is
  // added on top. When unchecked, whatever the user entered here is added
  // as a separate line before rounding.
  const installationFreight = installationFreightIncluded ? 0 : Math.max(0, installationFreightCost);
  const preRound = afterDiscount + installationFreight;
  const finalOffer = Math.round(preRound);
  const roundOff = finalOffer - preRound;
  return {
    total: markedUp,
    discount,
    afterDiscount,
    installationFreight,
    roundOff,
    finalOffer,
  };
}
