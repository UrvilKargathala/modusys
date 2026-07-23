import { mockMaterialItems, type MaterialCategoryKey } from "@/lib/mock/material-spec";

function findMaterialId(category: MaterialCategoryKey, name: string): string {
  const found = mockMaterialItems.find((m) => m.category === category && m.name === name);
  if (!found) throw new Error(`Seed error: no ${category} named "${name}" in Material Library`);
  return found.id;
}

// Each Component references Material Library for its Furniture Component
// type + the same four-way Thickness/Raw Material Type/Internal/External
// Colour combination Furniture Price List keys on — Rate is never stored
// here, it's looked up live against Furniture Price List by that
// combination (see cabinet-type-component-row.tsx).
export type CabinetComponent = {
  id: string;
  componentTypeId: string; // Material Library → Furniture Component
  widthFormula: string;
  heightFormula: string;
  thicknessId: string;
  rawMaterialTypeId: string;
  internalColourId: string;
  externalColourId: string;
  qty: number;
  remarks?: string;
};

export type CabinetType = {
  id: string;
  name: string;
  shortCode: string;
  active: boolean;
  brandId: string; // Material Library → Brand
  description: string;
  components: CabinetComponent[];
  deleted?: boolean;
  createdAt: string;
};

let componentSeedId = 0;
function component(input: Omit<CabinetComponent, "id">): CabinetComponent {
  componentSeedId += 1;
  return { ...input, id: `cc-${componentSeedId}` };
}

let cabinetSeedId = 0;
function cabinetType(input: Omit<CabinetType, "id" | "createdAt">): CabinetType {
  cabinetSeedId += 1;
  return { ...input, id: `ct-${cabinetSeedId}`, createdAt: new Date(Date.now() - cabinetSeedId * 86_400_000).toISOString() };
}

export const mockCabinetTypes: CabinetType[] = [
  cabinetType({
    name: "Base Cabinet",
    shortCode: "BC",
    active: true,
    brandId: findMaterialId("brand", "The Furn"),
    description: "Premium Base Cabinet",
    components: [
      component({
        componentTypeId: findMaterialId("furniture-component", "Shutter"),
        widthFormula: "(W-95)/2",
        heightFormula: "H-20",
        thicknessId: findMaterialId("thickness", "18mm"),
        rawMaterialTypeId: findMaterialId("raw-material-type", "BWP Ply"),
        internalColourId: findMaterialId("internal-colour", "White"),
        externalColourId: findMaterialId("external-colour", "Matte Charcoal"),
        qty: 2,
      }),
      component({
        componentTypeId: findMaterialId("furniture-component", "Back Panel"),
        widthFormula: "W-10",
        heightFormula: "H-10",
        thicknessId: findMaterialId("thickness", "16mm"),
        rawMaterialTypeId: findMaterialId("raw-material-type", "MDF"),
        internalColourId: findMaterialId("internal-colour", "Grey Oak"),
        externalColourId: findMaterialId("external-colour", "Walnut Wood Finish"),
        qty: 1,
      }),
    ],
  }),
  cabinetType({
    name: "Wall Cabinet",
    shortCode: "WC",
    active: true,
    brandId: findMaterialId("brand", "The Furn"),
    description: "Standard Wall-Mounted Cabinet",
    components: [
      component({
        componentTypeId: findMaterialId("furniture-component", "Shelf"),
        widthFormula: "W-20",
        heightFormula: "D-30",
        thicknessId: findMaterialId("thickness", "18mm"),
        rawMaterialTypeId: findMaterialId("raw-material-type", "Particle Board"),
        internalColourId: findMaterialId("internal-colour", "White"),
        externalColourId: findMaterialId("external-colour", "Glossy White"),
        qty: 3,
      }),
    ],
  }),
];
