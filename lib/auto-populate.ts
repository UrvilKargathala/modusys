import { findFurnitureMatch, isAluminiumProfileRawMaterial, resolveHardwareForUnit, resolveLineItemDimensions, type ShutterFinishOverrides } from "@/lib/quote-pricing";
import type { QuoteCabinet } from "@/lib/mock/quote";
import type { FurnitureLineItem, UnitType, UnitTypeHardware } from "@/lib/mock/unit-type";
import { rateAfterDiscount, type FurniturePriceItem, type HardwarePriceItem } from "@/lib/mock/pricing-list";

// Auto Populate: a Unit Type's template turned into the quote unit's cabinets for its W/D/H/Qty.
// Used by the unit card's Auto Populate button and by the drawing import, so both fill units the same way.

export function cloneLineItem(item: FurnitureLineItem): FurnitureLineItem {
  return { ...item, id: `qli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
}
// Older Unit Type templates only stored hardwareItemId (no independent
// articleNo/brandId/description/levelTypeId — those fields were added
// later). Backfill them from the matched Hardware Price List item so
// Auto Populate doesn't leave those columns blank for legacy templates.
export function cloneHardware(item: UnitTypeHardware, hardwareItems: HardwarePriceItem[]): UnitTypeHardware {
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

export function buildCabinetsFromUnitType(
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
  // Accessory-only Unit Types (e.g. "Kitchen Accessories", "Light Unit")
  // may have no cabinet-type links at all. Without a fallback the map()
  // would return [] and Auto Populate would appear to do nothing. Emit one
  // empty-carcass cabinet that still carries the unit-wide components /
  // finishes / hardware / panels so the pricing renders.
  if (unitType.cabinetTypeLinks.length === 0) {
    return [{
      id: `qc-${Date.now()}-0-${Math.random().toString(36).slice(2, 8)}`,
      cabinetTypeId: "",
      label: "",
      components: unitType.components.map(resolve),
      externalFinishes: unitType.externalFinishes.map(resolve),
      hardware: unitType.hardware.map(resolveHw),
      panels: unitType.otherPanels.map(resolve),
    }];
  }
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

export type AutoPopulateContext = {
  cabinetTypeName: (id: string) => string;
  hardwareItems: HardwarePriceItem[];
  furnitureItems: FurniturePriceItem[];
  shutterFinishId: string;
  shutterFinishOverrides?: ShutterFinishOverrides;
};

// The cabinets plus the quote's Shutter Finish: every Shutter row takes the quote's finish (Aluminium Profile
// shutters excepted) and the price-list rate for that new combination.
export function autoPopulateCabinets(
  unitType: UnitType,
  unitDims: { width: number; depth: number; height: number; qty: number },
  ctx: AutoPopulateContext
): QuoteCabinet[] {
  const { shutterFinishId, shutterFinishOverrides: o, furnitureItems } = ctx;
  const cabinets = buildCabinetsFromUnitType(unitType, ctx.cabinetTypeName, unitDims, ctx.hardwareItems, furnitureItems);
  const hasOverrides = shutterFinishId || (o && Object.values(o).some(Boolean));
  if (!hasOverrides) return cabinets;
  const withListRate = (f: FurnitureLineItem) => ({ ...f, rateOverride: findFurnitureMatch(f, furnitureItems)?.rate });
  return cabinets.map((c) => ({
    ...c,
    // The rate goes with the new combination, not the Unit Type's original one.
    externalFinishes: c.externalFinishes.map((f) =>
      isAluminiumProfileRawMaterial(f.rawMaterialTypeId)
        ? f
        : withListRate({
            ...f,
            ...(o?.shutterFinishThicknessId && { thicknessId: o.shutterFinishThicknessId }),
            ...(o?.shutterFinishRawMaterialId && { rawMaterialTypeId: o.shutterFinishRawMaterialId }),
            ...(o?.shutterFinishInternalColourId && { internalColourId: o.shutterFinishInternalColourId }),
            ...((o?.shutterFinishExternalColourId || shutterFinishId) && {
              externalColourId: o?.shutterFinishExternalColourId || shutterFinishId,
            }),
          })
    ),
  }));
}
