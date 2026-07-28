export type MaterialCategoryGroup = "specification" | "library";

export type MaterialCategoryKey =
  // Material Specification
  | "raw-material-description"
  | "handle-type"
  | "hinges-type"
  | "client-responsibility"
  | "product-type"
  | "property-type"
  | "space"
  | "sales-executive"
  | "designer"
  | "site-engineer"
  | "tandem-drawer-type"
  // Material Library
  | "furniture-component"
  | "raw-material-type"
  | "internal-colour"
  | "external-colour"
  | "thickness"
  | "category"
  | "brand"
  | "unit"
  | "level-type";

export type MaterialCategory = {
  key: MaterialCategoryKey;
  group: MaterialCategoryGroup;
  label: string;
  // Raw Material Description supports a fuller free-text description than a
  // simple name-only vocabulary entry (per spec) — everything else just has
  // an optional short description.
  longDescription?: boolean;
  // Category/Brand are name-only lookups — no description field.
  noDescription?: boolean;
};

export const materialCategories: MaterialCategory[] = [
  // No seed entries yet — added now so it exists as a stable reference key
  // other areas can start pointing at, populated later once its real values
  // are known.
  { key: "product-type", group: "specification", label: "Product Type", noDescription: true },
  { key: "property-type", group: "specification", label: "Property Type", noDescription: true },
  { key: "space", group: "specification", label: "Space", noDescription: true },
  { key: "raw-material-description", group: "specification", label: "Raw Material Description", longDescription: true },
  { key: "handle-type", group: "specification", label: "Handle Type" },
  { key: "hinges-type", group: "specification", label: "Hinges Type" },
  { key: "client-responsibility", group: "specification", label: "Client Responsibility" },
  { key: "tandem-drawer-type", group: "specification", label: "Tandem Drawer Type", noDescription: true },
  { key: "sales-executive", group: "specification", label: "Sales Executive", noDescription: true },
  { key: "designer", group: "specification", label: "Designer", noDescription: true },
  { key: "site-engineer", group: "specification", label: "Site Engineer", noDescription: true },
  { key: "furniture-component", group: "library", label: "Furniture Component" },
  { key: "raw-material-type", group: "library", label: "Raw Material Type" },
  { key: "internal-colour", group: "library", label: "Internal Colours and Description" },
  { key: "external-colour", group: "library", label: "External Colours and Description" },
  { key: "thickness", group: "library", label: "Thickness" },
  { key: "category", group: "library", label: "Category", noDescription: true },
  { key: "brand", group: "library", label: "Brand", noDescription: true },
  { key: "unit", group: "library", label: "Unit", noDescription: true },
  { key: "level-type", group: "library", label: "Level Type", noDescription: true },
];

export function getMaterialCategory(key: MaterialCategoryKey) {
  return materialCategories.find((c) => c.key === key)!;
}

export type MaterialItem = {
  id: string;
  category: MaterialCategoryKey;
  name: string;
  description: string;
  deleted?: boolean;
  createdAt: string;
};

let seedId = 0;
function item(category: MaterialCategoryKey, name: string, description = ""): MaterialItem {
  seedId += 1;
  return {
    id: `mat-${seedId}`,
    category,
    name,
    description,
    createdAt: new Date(Date.now() - seedId * 86_400_000).toISOString(),
  };
}

export const mockMaterialItems: MaterialItem[] = [
  // Raw Material Description
  item("raw-material-description", "18mm BWP Ply with White Suede Laminate", "Exterior grade, moisture resistant, matte finish"),
  item("raw-material-description", "16mm MDF with Textured Laminate", "Standard interior carcass material"),
  item("raw-material-description", "25mm Particle Board Pre-laminated", "Used for base units and shelving"),

  // Handle Type
  item("handle-type", "Profile Handle — Aluminium"),
  item("handle-type", "D-Handle — Stainless Steel"),
  item("handle-type", "Push-to-Open (Handleless)"),
  item("handle-type", "Knob Handle — Brass Finish"),

  // Hinges Type
  item("hinges-type", "Soft-Close Concealed Hinge"),
  item("hinges-type", "Standard Concealed Hinge"),
  item("hinges-type", "Piano Hinge"),

  // Client Responsibility
  item("client-responsibility", "Electrical wiring for under-cabinet lighting"),
  item("client-responsibility", "Plumbing connections for sink unit"),
  item("client-responsibility", "Civil work / wall preparation"),

  // Property Type
  item("property-type", "Apartment"),
  item("property-type", "Villa"),
  item("property-type", "Bungalow"),
  item("property-type", "Row House"),
  item("property-type", "Penthouse"),
  item("property-type", "Duplex"),
  item("property-type", "Commercial Office"),

  // Space
  item("space", "Kitchen"),
  item("space", "Master Room"),
  item("space", "Son Room"),
  item("space", "Daughter Room"),
  item("space", "Kids Room"),

  // Sales Executive
  item("sales-executive", "Chirag Patel"),
  item("sales-executive", "Soham Patel"),
  item("sales-executive", "Vipul Dodiya"),
  item("sales-executive", "Devangee Sailor"),

  // Designer
  item("designer", "Priti Thakur"),
  item("designer", "Henil Patel"),
  item("designer", "Meenal Deshpande"),
  item("designer", "Kavita Rao"),

  // Site Engineer
  item("site-engineer", "Brijesh Mendapara"),
  item("site-engineer", "Vijay Bhaskar"),
  item("site-engineer", "Mihir Patel"),

  // Tandem Drawer Type
  item("tandem-drawer-type", "Blum Antaro"),
  item("tandem-drawer-type", "Blum Legrabox"),
  item("tandem-drawer-type", "Ebco Slim"),
  item("tandem-drawer-type", "Grass Nova Pro"),
  item("tandem-drawer-type", "Grass Scala"),

  // Furniture Component
  item("furniture-component", "Shutter"),
  item("furniture-component", "Panel"),
  item("furniture-component", "Back Panel"),
  item("furniture-component", "Shelf"),
  item("furniture-component", "Skirting"),

  // Raw Material Type
  item("raw-material-type", "BWP Ply", "Boiling waterproof plywood"),
  item("raw-material-type", "MDF", "Medium density fibreboard"),
  item("raw-material-type", "Particle Board", "Pre-laminated particle board"),
  item("raw-material-type", "Marine Ply", "High moisture resistance"),

  // Internal Colours
  item("internal-colour", "White", "Suede finish laminate interior"),
  item("internal-colour", "Ivory", "Matte finish laminate interior"),
  item("internal-colour", "Grey Oak", "Woodgrain textured interior"),

  // External Colours
  item("external-colour", "Matte Charcoal", "High-gloss resistant matte exterior"),
  item("external-colour", "Glossy White", "High-gloss acrylic exterior"),
  item("external-colour", "Walnut Wood Finish", "Textured woodgrain exterior laminate"),

  // Thickness
  item("thickness", "16mm"),
  item("thickness", "18mm"),
  item("thickness", "25mm"),

  // Category (Hardware Price List)
  item("category", "Hinges"),
  item("category", "Tandem Runner"),
  item("category", "Lift Up"),
  item("category", "Kitchen Accessories"),
  item("category", "Handle"),
  item("category", "Kitchen Misc H/W"),
  item("category", "Light"),
  item("category", "Wardrobe Accessories"),
  item("category", "Qudro Runner"),
  item("category", "Accessories"),

  // Brand (Hardware Price List)
  item("brand", "Blum"),
  item("brand", "Ebco"),
  item("brand", "Hettich"),
  item("brand", "Higold"),
  item("brand", "Kessebohmer"),
  item("brand", "Vita"),
  item("brand", "Nimmi"),
  item("brand", "Rehau"),
  item("brand", "Olive"),
  item("brand", "Astronea"),
  item("brand", "The Furn"),

  // Unit (Hardware Price List)
  item("unit", "Set"),
  item("unit", "Pcs"),
  item("unit", "Mtr"),
  item("unit", "Inch"),
  item("unit", "R.ft"),
  item("unit", "Sq.ft"),
  item("unit", "MM"),

  // Level Type
  item("level-type", "Primary"),
  item("level-type", "Secondary"),
];
