import { mockMaterialItems, type MaterialCategoryKey } from "@/lib/mock/material-spec";

function findMaterialId(category: MaterialCategoryKey, name: string): string {
  const found = mockMaterialItems.find((m) => m.category === category && m.name === name);
  if (!found) throw new Error(`Seed error: no ${category} named "${name}" in Material Library`);
  return found.id;
}

export type FurniturePriceItem = {
  id: string;
  thicknessId: string;
  rawMaterialTypeId: string;
  internalColourId: string;
  externalColourId: string;
  rate: number; // ₹ per sq ft
  deleted?: boolean;
  createdAt: string;
};

let furnitureSeedId = 0;
function furnitureItem(thickness: string, rawMaterialType: string, internalColour: string, externalColour: string, rate: number): FurniturePriceItem {
  furnitureSeedId += 1;
  return {
    id: `fpl-${furnitureSeedId}`,
    thicknessId: findMaterialId("thickness", thickness),
    rawMaterialTypeId: findMaterialId("raw-material-type", rawMaterialType),
    internalColourId: findMaterialId("internal-colour", internalColour),
    externalColourId: findMaterialId("external-colour", externalColour),
    rate,
    createdAt: new Date(Date.now() - furnitureSeedId * 86_400_000).toISOString(),
  };
}

export const mockFurniturePriceItems: FurniturePriceItem[] = [
  furnitureItem("18mm", "BWP Ply", "White", "Matte Charcoal", 145),
  furnitureItem("18mm", "BWP Ply", "Ivory", "Glossy White", 138),
  furnitureItem("16mm", "MDF", "Grey Oak", "Walnut Wood Finish", 110),
  furnitureItem("25mm", "Particle Board", "White", "Glossy White", 95),
];

// Hardware — Article No. + Brand together are the unique key (business
// confirmed a generic part sold under two brands gets separate rows, since
// they're priced differently). Category, Brand and Unit are all single-value
// references into Material Library (Category was originally spec'd as
// multi-value, but the business confirmed a hardware item only ever needs
// one category in practice).
export type HardwarePriceItem = {
  id: string;
  articleNo: string;
  categoryId: string;
  brandId: string;
  unitId: string;
  levelTypeId?: string; // Material Library → Level Type (optional)
  description: string;
  mrp: number;
  discountPct: number;
  deleted?: boolean;
  createdAt: string;
};

export function rateAfterDiscount(item: Pick<HardwarePriceItem, "mrp" | "discountPct">) {
  return item.mrp * (1 - item.discountPct / 100);
}

let hardwareSeedId = 0;
function hardwareItem(input: Omit<HardwarePriceItem, "id" | "createdAt">): HardwarePriceItem {
  hardwareSeedId += 1;
  return { ...input, id: `hpl-${hardwareSeedId}`, createdAt: new Date(Date.now() - hardwareSeedId * 86_400_000).toISOString() };
}

export const mockHardwarePriceItems: HardwarePriceItem[] = [
  hardwareItem({
    articleNo: "BLM-CLIP-110",
    categoryId: findMaterialId("category", "Hinges"),
    brandId: findMaterialId("brand", "Blum"),
    unitId: findMaterialId("unit", "Pcs"),
    description: "Clip Top Soft-Close Hinge, 110°, full overlay",
    mrp: 420,
    discountPct: 15,
  }),
  hardwareItem({
    articleNo: "HTC-TR-450",
    categoryId: findMaterialId("category", "Tandem Runner"),
    brandId: findMaterialId("brand", "Hettich"),
    unitId: findMaterialId("unit", "Set"),
    description: "Tandem Box Runner, 450mm, soft-close",
    mrp: 1850,
    discountPct: 20,
  }),
  hardwareItem({
    articleNo: "EBC-LFT-01",
    categoryId: findMaterialId("category", "Lift Up"),
    brandId: findMaterialId("brand", "Ebco"),
    unitId: findMaterialId("unit", "Set"),
    description: "Lift-Up System for wall cabinets, gas-strut assisted",
    mrp: 3200,
    discountPct: 10,
  }),
  hardwareItem({
    articleNo: "TFN-HDL-PRF",
    categoryId: findMaterialId("category", "Handle"),
    brandId: findMaterialId("brand", "The Furn"),
    unitId: findMaterialId("unit", "Mtr"),
    description: "Aluminium Profile Handle, brushed finish",
    mrp: 650,
    discountPct: 5,
  }),
];
