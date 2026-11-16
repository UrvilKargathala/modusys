"use client";

import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import type { MaterialCategoryKey } from "@shared/mock/material-spec";

export type MaterialDependency = {
  module: string;
  page: string;
  record: string;
  count: number;
};

type MaterialRefFields = {
  thicknessId: string;
  rawMaterialTypeId: string;
  internalColourId: string;
  externalColourId: string;
};

const materialFields = ["thicknessId", "rawMaterialTypeId", "internalColourId", "externalColourId"] as const;

function matchesMaterial(item: MaterialRefFields, itemId: string) {
  return materialFields.some((f) => item[f] === itemId);
}

// Scans every place a Material Library value can be referenced across the
// app (Pricing List, Cabinet Type, Unit Type) so Material Spec's delete flow
// can warn before removing something still in use, instead of silently
// leaving other records pointing at a deleted id.
export function useMaterialDependencies(category: MaterialCategoryKey, itemId: string): MaterialDependency[] {
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();
  const cabinetTypes = useCabinetTypes();
  const unitTypes = useUnitTypes();

  if (!itemId) return [];

  const deps: MaterialDependency[] = [];
  const isFurnitureMaterial =
    category === "thickness" || category === "raw-material-type" || category === "internal-colour" || category === "external-colour";

  if (isFurnitureMaterial) {
    const count = furnitureItems.filter((i) => matchesMaterial(i, itemId)).length;
    if (count > 0) deps.push({ module: "Pricing List", page: "Furniture Price List", record: "priced combinations", count });
  }

  if (category === "category") {
    const count = hardwareItems.filter((h) => h.categoryId === itemId).length;
    if (count > 0) deps.push({ module: "Pricing List", page: "Hardware Price List", record: "hardware SKUs", count });
  }

  if (category === "brand") {
    const hwCount = hardwareItems.filter((h) => h.brandId === itemId).length;
    if (hwCount > 0) deps.push({ module: "Pricing List", page: "Hardware Price List", record: "hardware SKUs", count: hwCount });
    const ctCount = cabinetTypes.filter((c) => !c.deleted && c.brandId === itemId).length;
    if (ctCount > 0) deps.push({ module: "Cabinet Type", page: "Cabinet Type", record: "cabinet types", count: ctCount });
  }

  if (category === "unit") {
    const count = hardwareItems.filter((h) => h.unitId === itemId).length;
    if (count > 0) deps.push({ module: "Pricing List", page: "Hardware Price List", record: "hardware SKUs", count });
  }

  if (category === "furniture-component") {
    let ctCount = 0;
    for (const c of cabinetTypes) {
      if (c.deleted) continue;
      ctCount += c.components.filter((comp) => comp.componentTypeId === itemId).length;
    }
    if (ctCount > 0) deps.push({ module: "Cabinet Type", page: "Cabinet Type", record: "component rows", count: ctCount });

    let utCount = 0;
    for (const u of unitTypes) {
      if (u.deleted) continue;
      utCount += u.components.filter((comp) => comp.componentTypeId === itemId).length;
    }
    if (utCount > 0) deps.push({ module: "Unit Type", page: "Unit Type — Components", record: "component rows", count: utCount });
  }

  if (isFurnitureMaterial) {
    let ctCount = 0;
    for (const c of cabinetTypes) {
      if (c.deleted) continue;
      ctCount += c.components.filter((comp) => matchesMaterial(comp, itemId)).length;
    }
    if (ctCount > 0) deps.push({ module: "Cabinet Type", page: "Cabinet Type", record: "component rows", count: ctCount });

    let utComp = 0;
    let utExt = 0;
    let utOther = 0;
    for (const u of unitTypes) {
      if (u.deleted) continue;
      utComp += u.components.filter((comp) => matchesMaterial(comp, itemId)).length;
      utExt += u.externalFinishes.filter((comp) => matchesMaterial(comp, itemId)).length;
      utOther += u.otherPanels.filter((comp) => matchesMaterial(comp, itemId)).length;
    }
    if (utComp > 0) deps.push({ module: "Unit Type", page: "Unit Type — Components", record: "component rows", count: utComp });
    if (utExt > 0) deps.push({ module: "Unit Type", page: "Unit Type — External Finish", record: "rows", count: utExt });
    if (utOther > 0) deps.push({ module: "Unit Type", page: "Unit Type — Other Panel", record: "rows", count: utOther });
  }

  return deps;
}
