import { z } from "zod";
import { normalizeVariantId } from "./variant-id";

// Drawing PDF → draft quote (docs/PDF_TO_QUOTE_PLAN.md).
// Claude reads the drawing; this file holds what it is told (DRAWING_RULES), the shape it must answer in
// (draftSchema) and the arithmetic done in code afterwards (finalizeDraft): rounding, LED total, cutlery tray,
// name → id, flags. No server or SDK imports, so the review screen and the check file can use it too.

export type Named = { id: string; name: string };
export type VariantRow = { variantId: string; thickness: string; externalColour: string };
export type ImportLists = {
  unitTypes: Named[];
  productTypes: Named[];
  cabinetDescriptions: Named[];
  handles: Named[];
  hinges: Named[];
  tandemDrawerTypes: Named[];
  spaces: Named[];
  variants: VariantRow[];
};

// Added by code after the units, never read from the drawing.
export const KITCHEN_ACCESSORIES = "Kitchen Accessories";
export const LIGHT_UNIT = "Light Unit";

const uniqueNames = (list: Named[]) => [...new Set(list.map((n) => n.name.trim()).filter(Boolean))];
// z.enum needs at least one value; an empty list (a fresh install) falls back to free text.
const oneOf = (list: Named[]) => {
  const names = uniqueNames(list);
  return names.length ? z.enum(names as [string, ...string[]]) : z.string();
};

export function draftSchema(l: ImportLists) {
  const unitTypes = l.unitTypes.filter((u) => u.name.trim() !== KITCHEN_ACCESSORIES && u.name.trim() !== LIGHT_UNIT);
  return z.object({
    spec: z.object({
      productType: oneOf(l.productTypes),
      cabinetDescription: oneOf(l.cabinetDescriptions),
      variantIdText: z.string(),
      handle: oneOf(l.handles),
      tandemDrawerType: oneOf(l.tandemDrawerTypes),
      hinges: oneOf(l.hinges),
    }),
    units: z.array(
      z.object({
        order: z.number().int(),
        wall: z.string(),
        label: z.string(),
        unitType: oneOf(unitTypes),
        space: oneOf(l.spaces),
        width: z.number(),
        depth: z.number(),
        height: z.number(),
        heightScaled: z.boolean(),
        sources: z.array(z.string()),
        note: z.string(),
      })
    ),
    excluded: z.array(z.object({ label: z.string(), reason: z.enum(["appliance", "filler", "civil", "layout-only", "other"]) })),
    ledStrips: z.array(z.object({ unitOrder: z.number().int().nullable(), orientation: z.enum(["horizontal", "vertical"]), lengthMm: z.number() })),
    hobDrawerUnitOrder: z.number().int().nullable(),
    detergentPullOut: z.boolean(),
    spotLights: z.number().int(),
    flags: z.array(z.string()),
  });
}
export type Draft = z.infer<ReturnType<typeof draftSchema>>;

export const DRAWING_RULES = `You read kitchen drawings made by The Furn, a modular kitchen maker in Surat, India, and list the furniture units for a quotation. Your list is checked by a person before the quote is made, so when something is unclear, make your best reading and say so in flags.

The drawing: sheet L1.01 is the layout (plan view) with the Material Specification table, unit labels, widths and depths. Sheets E1.01-A, B, C, D are the elevations of each wall, with heights, drawer and shutter lines, and yellow glow showing LED lights. All dimensions are in mm.

Material Specification: choose the allowed option closest to what the table says. Copy the Variant Id text exactly as written into variantIdText.

Which units to list
- Only furniture units that appear in an elevation. A unit drawn only on the layout goes in excluded with reason "layout-only": cancelled units sometimes stay on the layout.
- These are not units; put them in excluded: appliances (fridge, hob, chimney hood, oven, microwave, dishwasher machine), fillers (usually 20 or 50 wide), gas-line packing, on-site partitions and other civil work, stone tops and breakfast counters, MS stands.
- One entry per physical unit. Three identical drawer units are three entries, never one entry with quantity 3.
- Do not list Kitchen Accessories or Light Unit; they are added afterwards.

Unit type (always one of the allowed names)
- Read the label, then check the unit in its elevation. Where they disagree, the elevation wins: glass in a frame means the "Profile Shutter" type; count drawers from the drawer lines or drawer labels (two stacked means 2 Tandem Drawers, three means 3 Tandem Drawers).
- Semi Modular Kitchen: base units are the "Divider" types. Fully Modular Kitchen: base units are the "Cabinet" types. Tall units are always Cabinet types. Island units are always Cabinet types, even in a semi-modular kitchen.
- Sink: one unit whose width is the sum of its shutters as dimensioned (450 + 450 = 900). If the drawing mentions a detergent pull-out, set detergentPullOut.
- A base unit labelled Pull Out is a pull-out Unit Type (one with Pull-Out in its name; Cabinet or Divider by the kitchen type), never a shutter & shelf unit.
- Blind corner (a shutter on one wall, the corner itself hidden): width = visible shutter + depth of the base run on the other wall (450 + 635 = 1085). L-corner (shutters on both walls): width and depth both = visible shutter + base depth (450 + 635 = 1085). A corner is never left out: it always goes into the unit beside it. When the other wall's elevation dimensions the corner part (a blank 684 at the end of that wall), use that figure instead of the base depth (sink shutters 396 + 396 next to a 684 corner = 1476).
- Wall units stacked in rows: each row is its own unit (two 375-high lift-up rows are two units). Both rows over the hob are Chimney wall units. A chimney wall unit with the hood drawn inside it (tucked up within the wall-unit band) is 60 less than the band height (1330 → 1270); with the hood hanging below it, the full band height.
- Split a tall unit only when its shutter itself is over 2400 high: the part above 2400 is then a separate Loft Unit With Shutter & Shelf with the same width and depth. When the shutter is 2400 or less (an oven tall unit 2650 high with a 1650 shutter above the oven opening), it stays one unit with its full height. But a tall column whose top shutter row lines up with a loft beside it (the same top row running over the fridge) is two units: the tall unit below that row and a Loft Unit With Shutter & Shelf for the row (a 2880 oven column with a 980 top row = tall unit 1900 + loft 980).
- A loft is Loft Unit With Shutter & Shelf unless the drawing says it has no shelf.
- An oven tall unit whose upper part has a glass (profile) shutter is three units stacked: Crockery Unit With Profile Shutter & Shelf (the glass part), the OTG / Microwave tall unit (the oven and drawer part), and Base Unit Cabinet With Wicker Basket (the bottom). With solid shutters it stays one OTG / Microwave tall unit, and its wicker baskets are hardware inside it.
- A rolling-shutter unit (often labelled M.TALL) is only the rolling-shutter section that stands on the counter, with the height of that section. Anything above it (a shutter section, an open part) and the base unit below it are separate units.
- Units drawn inside the wall-unit band are wall units even when labelled loft (a glass lift-up there is Wall Unit With Lift Up Profile Shutter); open shelves beside or below them are a niche unit. Lofts sit above the wall-unit band, above tall units or above the fridge.
- Dishwasher: Base Unit Dish Washer Shutter, depth 0, height = counter height as dimensioned.

Sizes
- Width as dimensioned; do not round it. Depth as dimensioned in the plan (layout L1.01); never take a depth from a section seen in an elevation. Height from the elevation's vertical dimension chain.
- Base unit depth is the cabinet's. When the plan dimensions a base run with its countertop depth, which includes the top's 50 overhang (685 where the cabinet is 635), the base units are 50 less (685 means 635). Corner widths use the cabinet depth (450 + 635, not 450 + 685).
- Tall run (tall units, crockery units, and the lofts above them or above the fridge): depth = plan depth minus 20 for the shutter (709 → 689, 420 → 400). Width stays the plan's (crockery 390 + 390 = 780, not the shutters 386 + 386).
- When a height is not dimensioned, work it out against nearby dimensions by scale and set heightScaled.
- note: when the drawing marks a visible (exposed side) panel on a unit, say which side here.
- sources: the sheets you read the unit from, for example ["L1.01", "E1.01-B"].

LED: list every yellow glow strip in ledStrips, including the glow along the top inside each glass (profile) cabinet: a lit glass cabinet is one strip of its own, separate from any strip under it. A horizontal strip under or inside a unit: give that unit's order in unitOrder (its width is used). A lit glass cabinet also has a vertical strip on both sides: two strips, unitOrder null, each lengthMm = the cabinet's height. There is never LED under the chimney hood. spotLights: the number of spot lights drawn.
hobDrawerUnitOrder: the order of the drawer unit the gas hob sits on.

Order: walk the room wall by wall (A, B, C, D). On each wall list the base and tall units from left to right as seen in that wall's elevation, then the wall units and lofts above them from left to right. The island comes last. order starts at 1.

flags: anything a person should check, such as a label that disagrees with the elevation, a size you had to work out, text you could not read, or a unit that could be two types (choose the closer one and name the other).`;

// ponytail: rounds only widths that aren't a multiple of 5 (691 → 700); the owner's exact rule is still open
// (plan → Open questions: 560 → 600 was rounded, 815 and 990 were not).
export const roundWidth = (w: number) => (w % 5 === 0 ? w : Math.ceil(w / 50) * 50);

// Cutlery trays come in 500–900: the drawer unit's width rounded down to 100 (815 → 800).
export const cutleryTray = (unitWidth: number) => Math.min(900, Math.max(500, Math.floor(unitWidth / 100) * 100));

const words = (s: string) => new Set(s.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));

// The exact Variant ID code wins; otherwise every price row whose thickness and external colour words all
// appear in the text ("Technomatt-18mm-Birch" → the 18mm "Technomatt - Birch" rows).
export function variantMatches(text: string, variants: VariantRow[]): VariantRow[] {
  const code = normalizeVariantId(text);
  const exact = variants.filter((v) => normalizeVariantId(v.variantId) === code);
  if (exact.length) return exact;
  const inText = words(text);
  const allIn = (s: string) => s.trim() !== "" && [...words(s)].every((w) => inText.has(w));
  return variants.filter((v) => allIn(v.externalColour) && allIn(v.thickness));
}

export type FinalUnit = {
  order: number;
  wall: string;
  label: string;
  unitType: string;
  unitTypeId: string | null;
  spaceId: string | null;
  drawnWidth: number;
  width: number;
  depth: number;
  height: number;
  qty: 1;
  sources: string[];
  note: string;
  flags: string[];
};

export type FinalDraft = {
  spec: {
    productTypeId: string | null;
    materialDescriptionId: string | null;
    handleTypeId: string | null;
    hingesTypeId: string | null;
    tandemDrawerTypeId: string | null;
    variant: VariantRow | null;
    variantCandidates: VariantRow[];
  };
  units: FinalUnit[];
  ledMm: number;
  cutleryTrayMm: number | null;
  cleaningAgent: boolean;
  spotLights: number;
  flags: string[];
};

export function finalizeDraft(d: Draft, l: ImportLists): FinalDraft {
  const flags = [...d.flags];
  const idOf = (list: Named[], name: string, what: string) => {
    const id = list.find((n) => n.name.trim() === name.trim())?.id ?? null;
    if (!id) flags.push(`${what} "${name}" is not in the list; pick it by hand`);
    return id;
  };

  const units: FinalUnit[] = d.units.map((u) => {
    const width = roundWidth(u.width);
    const unitFlags: string[] = [];
    if (width !== u.width) unitFlags.push(`Width ${u.width} rounded up to ${width}`);
    if (u.heightScaled) unitFlags.push(`Height ${u.height} read by scale`);
    if (!u.sources.some((s) => /^E/i.test(s.trim()))) unitFlags.push("Not found in any elevation");
    if (/tall/i.test(u.unitType) && u.height > 2400) unitFlags.push("Tall unit over 2400: kept whole because its shutter is 2400 or less; check");
    if (/visible/i.test(u.note)) unitFlags.push(`Visible panel: ${u.note}`);
    const unitTypeId = l.unitTypes.find((t) => t.name.trim() === u.unitType.trim())?.id ?? null;
    if (!unitTypeId) unitFlags.push(`Unit Type "${u.unitType}" is not in the list`);
    return {
      order: u.order,
      wall: u.wall,
      label: u.label,
      unitType: u.unitType,
      unitTypeId,
      spaceId: l.spaces.find((s) => s.name.trim() === u.space.trim())?.id ?? null,
      drawnWidth: u.width,
      width,
      depth: u.depth,
      height: u.height,
      qty: 1,
      sources: u.sources,
      note: u.note,
      flags: unitFlags,
    };
  });

  for (const x of d.excluded) if (x.reason === "layout-only") flags.push(`Left out "${x.label}": only on the layout`);

  const byOrder = new Map(units.map((u) => [u.order, u]));
  const ledMm = d.ledStrips.reduce((sum, s) => {
    const unit = s.unitOrder == null ? undefined : byOrder.get(s.unitOrder);
    return sum + (s.orientation === "horizontal" && unit ? unit.width : s.lengthMm);
  }, 0);

  const hob = d.hobDrawerUnitOrder == null ? undefined : byOrder.get(d.hobDrawerUnitOrder);
  if (!hob) flags.push("No drawer unit under the hob found: pick the cutlery tray by hand");

  const candidates = variantMatches(d.spec.variantIdText, l.variants);
  const variant = candidates.length === 1 ? candidates[0] : null;
  if (!variant) {
    flags.push(
      candidates.length
        ? `Variant Id "${d.spec.variantIdText}" matches ${candidates.length} price rows (${candidates.map((c) => c.variantId).join(", ")}): pick one`
        : `Variant Id "${d.spec.variantIdText}" matches no price row: pick it by hand`
    );
  } else if (normalizeVariantId(variant.variantId) !== normalizeVariantId(d.spec.variantIdText)) {
    flags.push(`Variant Id "${d.spec.variantIdText}" is not an exact code; matched ${variant.variantId} by name`);
  }

  for (const name of [KITCHEN_ACCESSORIES, LIGHT_UNIT]) {
    if (!l.unitTypes.some((t) => t.name.trim() === name)) flags.push(`Unit Type "${name}" is missing from Templates`);
  }

  return {
    spec: {
      productTypeId: idOf(l.productTypes, d.spec.productType, "Product Type"),
      materialDescriptionId: idOf(l.cabinetDescriptions, d.spec.cabinetDescription, "Cabinet Description"),
      handleTypeId: idOf(l.handles, d.spec.handle, "Handle"),
      hingesTypeId: idOf(l.hinges, d.spec.hinges, "Hinges"),
      tandemDrawerTypeId: idOf(l.tandemDrawerTypes, d.spec.tandemDrawerType, "Tandem Drawer Type"),
      variant,
      variantCandidates: candidates,
    },
    units,
    ledMm,
    cutleryTrayMm: hob ? cutleryTray(hob.width) : null,
    cleaningAgent: d.detergentPullOut,
    spotLights: d.spotLights,
    flags,
  };
}
