import { mockMaterialItems, type MaterialCategoryKey } from "@/lib/mock/material-spec";
import { mockCabinetTypes } from "@/lib/mock/cabinet-type";
import { mockHardwarePriceItems } from "@/lib/mock/pricing-list";

function findMaterialId(category: MaterialCategoryKey, name: string): string {
  const found = mockMaterialItems.find((m) => m.category === category && m.name === name);
  if (!found) throw new Error(`Seed error: no ${category} named "${name}" in Material Library`);
  return found.id;
}

function findCabinetTypeId(shortCode: string): string {
  const found = mockCabinetTypes.find((c) => c.shortCode === shortCode);
  if (!found) throw new Error(`Seed error: no Cabinet Type with short code "${shortCode}"`);
  return found.id;
}

function findHardwareItemId(articleNo: string): string {
  const found = mockHardwarePriceItems.find((h) => h.articleNo === articleNo);
  if (!found) throw new Error(`Seed error: no Hardware Price List item "${articleNo}"`);
  return found.id;
}

// Shared row shape for both Components and External Finish — same four-way
// Thickness/Raw Material Type/Internal/External Colour combination Furniture
// Price List keys on, Rate is never stored, always looked up live (see
// furniture-line-item-row.tsx). componentTypeId only applies to Components
// (Furniture Component name); External Finish rows leave it unset.
export type FurnitureLineItem = {
  id: string;
  componentTypeId?: string;
  // Components only. sourceLinkId groups this row under one attached
  // Cabinet Type group (see UnitTypeCabinetTypeLink below) — undefined means
  // a standalone/manual row, not tied to any group. isExtra marks a row
  // added via a group's own "+ Add Component" after the snapshot (shown as
  // "+ Custom", not "Customized"). isCustomized flips true the first time a
  // snapshotted row's fields are edited away from their original Cabinet
  // Type values.
  sourceLinkId?: string;
  isExtra?: boolean;
  isCustomized?: boolean;
  widthFormula: string;
  heightFormula: string;
  thicknessId: string;
  rawMaterialTypeId: string;
  internalColourId: string;
  externalColourId: string;
  levelTypeId?: string; // Material Library → Level Type (optional)
  qty: number;
  // Manual Rate override — when set, pricing uses this instead of the
  // Furniture Price List match. Undefined/cleared falls back to the
  // price-list rate as before.
  rateOverride?: number;
};

// One row per attached Cabinet Type "slot" — a distinct id from the Cabinet
// Type itself, since the same Cabinet Type can be attached more than once
// (e.g. two Base Cabinet groups with different customizations). `id` is what
// FurnitureLineItem.sourceLinkId points at; `cabinetTypeId` is which Cabinet
// Type that slot was populated from.
export type UnitTypeCabinetTypeLink = {
  id: string;
  cabinetTypeId: string;
};

// Brand/Unit/Rate/Article No. are never stored here either — they're read
// live off the matched Hardware Price List item (see unit-type-hardware-row.tsx),
// so a price/brand correction there reflects everywhere it's referenced.
export type UnitTypeHardware = {
  id: string;
  categoryId: string; // Material Library → Category
  hardwareItemId: string; // Hardware Price List item id (used to derive Unit/Rate)
  qtyFormula: string; // number or formula, e.g. "2" or "H/450"
  // User-editable overrides (Phase B4): Article No. is free-typed, Brand and
  // Description are picked directly from Hardware Price List (no Category
  // gate), Level Type comes from Material Library.
  articleNo?: string;
  brandId?: string;
  description?: string;
  levelTypeId?: string;
  // Manual Rate override — when set, pricing uses this instead of the
  // Hardware Price List's rate-after-discount. Undefined/cleared falls
  // back to the price-list rate as before.
  rateOverride?: number;
};

export type UnitType = {
  id: string;
  name: string;
  shortCode: string;
  active: boolean;
  brandId: string; // Material Library → Brand
  description: string; // pulled from an attached Cabinet Type
  // Ordered — first entry is the primary Cabinet Type. Each attached Cabinet
  // Type's Components are snapshot-copied into `components` at attach time
  // (tagged via sourceLinkId), not live-linked. The same Cabinet Type may
  // appear more than once as separate links.
  cabinetTypeLinks: UnitTypeCabinetTypeLink[];
  components: FurnitureLineItem[];
  externalFinishes: FurnitureLineItem[];
  // Same shape/matching logic as externalFinishes — a catch-all standalone
  // panel builder for anything that isn't a Cabinet Type Component or an
  // External Finish (e.g. a loose back/divider panel).
  otherPanels: FurnitureLineItem[];
  hardware: UnitTypeHardware[];
  deleted?: boolean;
  createdAt: string;
};

let lineSeedId = 0;
function lineItem(input: Omit<FurnitureLineItem, "id">): FurnitureLineItem {
  lineSeedId += 1;
  return { ...input, id: `utc-${lineSeedId}` };
}

let hardwareSeedId = 0;
function hardwareLine(input: Omit<UnitTypeHardware, "id">): UnitTypeHardware {
  hardwareSeedId += 1;
  return { ...input, id: `uth-${hardwareSeedId}` };
}

let unitTypeSeedId = 0;
function unitType(input: Omit<UnitType, "id" | "createdAt">): UnitType {
  unitTypeSeedId += 1;
  return { ...input, id: `ut-${unitTypeSeedId}`, createdAt: new Date(Date.now() - unitTypeSeedId * 86_400_000).toISOString() };
}

export const mockUnitTypes: UnitType[] = [
  unitType({
    name: "Base Unit With 3 Tandem Drawers",
    shortCode: "BU3TBL-CLPT",
    active: true,
    brandId: findMaterialId("brand", "The Furn"),
    description: "",
    cabinetTypeLinks: [{ id: "utl-1", cabinetTypeId: findCabinetTypeId("BC") }],
    components: [
      lineItem({
        componentTypeId: findMaterialId("furniture-component", "Panel"),
        sourceLinkId: "utl-1",
        widthFormula: "W-36",
        heightFormula: "H-40",
        thicknessId: findMaterialId("thickness", "18mm"),
        rawMaterialTypeId: findMaterialId("raw-material-type", "BWP Ply"),
        internalColourId: findMaterialId("internal-colour", "White"),
        externalColourId: findMaterialId("external-colour", "Matte Charcoal"),
        qty: 2,
      }),
    ],
    externalFinishes: [
      lineItem({
        widthFormula: "W-4",
        heightFormula: "H-4",
        thicknessId: findMaterialId("thickness", "18mm"),
        rawMaterialTypeId: findMaterialId("raw-material-type", "BWP Ply"),
        internalColourId: findMaterialId("internal-colour", "Ivory"),
        externalColourId: findMaterialId("external-colour", "Glossy White"),
        qty: 1,
      }),
    ],
    otherPanels: [],
    hardware: [
      hardwareLine({
        categoryId: findMaterialId("category", "Tandem Runner"),
        hardwareItemId: findHardwareItemId("HTC-TR-450"),
        qtyFormula: "3",
      }),
      hardwareLine({
        categoryId: findMaterialId("category", "Hinges"),
        hardwareItemId: findHardwareItemId("BLM-CLIP-110"),
        qtyFormula: "H/450",
      }),
    ],
  }),
];
