// Run: npx tsx shared/drawing-import.check.ts   (free: no Claude call, checks the code-side arithmetic)
import assert from "node:assert/strict";
import { cutleryTray, draftSchema, finalizeDraft, variantMatches, type Draft, type ImportLists } from "./drawing-import";

const named = (...names: string[]) => names.map((name, i) => ({ id: `${name}#${i}`, name }));
const lists: ImportLists = {
  unitTypes: named(
    "Base Unit Divider Panels With 2 Tandem Drawers",
    "Wall Unit With Lift Up Profile Shutter",
    "Niche Unit With Self",
    "Tall Unit Cabinet With Shutter & Shelf",
    " Tall Unit Cabinate With Shutter, Shelf & Internal Tandem Drawer", // stored with a leading space in the DB
    "Kitchen Accessories",
    "Light Unit"
  ),
  productTypes: named("Semi Modular Kitchen", "Fully Modular Kitchen"),
  cabinetDescriptions: named("18mm BWP Ply"),
  handles: named("Gola Profile"),
  hinges: named("Blum"),
  tandemDrawerTypes: named("Blum Antaro"),
  spaces: named("Kitchen"),
  variants: [
    { variantId: "18MM-BIRCH-PLY-SFL-TB", thickness: "18mm", externalColour: "Technomatt - Birch" },
    { variantId: "18MM-BWP-PLY-LF-TB", thickness: "18mm", externalColour: "Technomatt - Birch" },
    { variantId: "18MM-BWP-PLY-SFL-TB-2", thickness: "18mm", externalColour: "Technomatt - BWP" },
  ],
};

// Helpers
assert.equal(cutleryTray(815), 800);
assert.equal(cutleryTray(900), 900);
assert.equal(cutleryTray(1200), 900);
assert.equal(cutleryTray(450), 500);
assert.deepEqual(variantMatches("18mm-bwp-ply-sfl-tb-2", lists.variants).map((v) => v.variantId), ["18MM-BWP-PLY-SFL-TB-2"]); // exact code, any case
assert.equal(variantMatches("Technomatt-18mm-Birch", lists.variants).length, 2); // ambiguous by name
assert.equal(variantMatches("LEMINATE-18MM-BWP", lists.variants).length, 0); // typo matches nothing

// The schema accepts the shape and rejects a unit type that isn't in Templates (or is added by code).
const schema = draftSchema(lists);
const unit = (order: number, unitType: string, width: number, depth: number, height: number, sources = ["L1.01", "E1.01-B"]) => ({
  order, wall: "B", label: unitType, unitType, space: "Kitchen", width, depth, height, heightScaled: false, sources, note: "",
});
const draft: Draft = {
  spec: { productType: "Semi Modular Kitchen", cabinetDescription: "18mm BWP Ply", variantIdText: "Technomatt-18mm-BWP", handle: "Gola Profile", tandemDrawerType: "Blum Antaro", hinges: "Blum" },
  units: [
    unit(1, "Base Unit Divider Panels With 2 Tandem Drawers", 700, 635, 750),
    unit(2, "Niche Unit With Self", 691, 370, 200),
    { ...unit(3, "Wall Unit With Lift Up Profile Shutter", 691, 350, 375), heightScaled: true },
    unit(4, "Tall Unit Cabinet With Shutter & Shelf", 600, 600, 2795),
    unit(5, "Tall Unit Cabinate With Shutter, Shelf & Internal Tandem Drawer", 600, 600, 2350, ["L1.01"]),
  ],
  excluded: [
    { label: "WALL UNIT ABOVE fridge", reason: "layout-only" },
    { label: "Fridge", reason: "appliance" },
  ],
  ledStrips: [
    { unitOrder: 2, orientation: "horizontal", lengthMm: 691 }, // counts the unit's width
    { unitOrder: 3, orientation: "horizontal", lengthMm: 691 },
    { unitOrder: null, orientation: "vertical", lengthMm: 750 },
  ],
  hobDrawerUnitOrder: 1,
  detergentPullOut: true,
  spotLights: 3,
  flags: ["Label says Single Lift Up Shutter, elevation shows glass"],
};
assert.equal(schema.safeParse(draft).success, true);
assert.equal(schema.safeParse({ ...draft, units: [unit(1, "Light Unit", 0, 0, 0)] }).success, false);
assert.equal(schema.safeParse({ ...draft, units: [unit(1, "Made Up Unit", 600, 600, 750)] }).success, false);

const final = finalizeDraft(draft, lists);
const [base, niche, wall, tall, internal] = final.units;
assert.equal(niche.width, 691); // widths are taken exactly as drawn, never rounded
assert.ok(!niche.flags.some((f) => /rounded/.test(f)));
assert.ok(wall.flags.includes("Height 375 read by scale"));
assert.ok(tall.flags.some((f) => f.startsWith("Tall unit over 2400")));
assert.ok(internal.unitTypeId, "unit type found despite the stored leading space");
assert.ok(internal.flags.includes("Not found in any elevation"));
assert.deepEqual(base.flags, []);
assert.equal(base.spaceId, "Kitchen#0");
assert.ok(final.units.every((u) => u.qty === 1));
assert.equal(final.ledMm, 691 + 691 + 750);
assert.equal(final.cutleryTrayMm, 700);
assert.equal(final.cleaningAgent, true);
assert.equal(final.spotLights, 3);
assert.equal(final.spec.productTypeId, "Semi Modular Kitchen#0");
assert.equal(final.spec.variant?.variantId, "18MM-BWP-PLY-SFL-TB-2");
assert.ok(final.flags.some((f) => f.includes("not an exact code")));
assert.ok(final.flags.includes('Left out "WALL UNIT ABOVE fridge": only on the layout'));
assert.ok(!final.flags.some((f) => f.includes("Fridge")));
assert.ok(final.flags.includes("Label says Single Lift Up Shutter, elevation shows glass"));

// No hob unit, ambiguous variant, missing Light Unit type → flags, not crashes.
const bare = finalizeDraft(
  { ...draft, hobDrawerUnitOrder: null, spec: { ...draft.spec, variantIdText: "Technomatt-18mm-Birch" } },
  { ...lists, unitTypes: lists.unitTypes.filter((t) => t.name !== "Light Unit") }
);
assert.equal(bare.cutleryTrayMm, null);
assert.equal(bare.spec.variant, null);
assert.equal(bare.spec.variantCandidates.length, 2);
assert.ok(bare.flags.some((f) => f.includes("matches 2 price rows")));
assert.ok(bare.flags.includes('Unit Type "Light Unit" is missing from Templates'));

console.log("drawing import ok");
