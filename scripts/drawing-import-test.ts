import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PrismaClient } from "@prisma/client";
import { makeDbAdapter } from "../lib/db-adapter";
import { finalizeDraft } from "../lib/drawing-import";
import { DRAWING_MODEL, loadImportLists, readDrawing } from "../lib/server/drawing-import";

// Runs real drawing PDFs through the import and compares with what the owner confirmed
// (docs/PDF_TO_QUOTE_PLAN.md → Test cases). PAID: each PDF is one Claude call, roughly ₹25–60. Ask first.
//
// Usage: npx tsx scripts/drawing-import-test.ts <drawing.pdf> [more.pdf ...]
// Needs DATABASE_URL (the lists) and ANTHROPIC_API_KEY in .env.local.

config({ path: ".env.local" });

type Unit = { type: string; w: number; d: number; h: number };
// approx: the height isn't dimensioned on the drawing, so a reading by scale within 30 mm counts as a match.
type Want = Unit & { approx: boolean };
type Expected = { units: Want[]; ledMm: number; trayMm: number; cleaningAgent: boolean };
const u = (type: string, w: number, d: number, h: number, times = 1, approx = false): Want[] =>
  Array.from({ length: times }, () => ({ type, w, d, h, approx }));
const label = (x: Unit) => `${x.type} ${x.w}×${x.d}×${x.h}`;

const DIVIDER_2TD = "Base Unit Divider Panels With 2 Tandem Drawers";
const DIVIDER_3TD = "Base Unit Divider Panels With 3 Tandem Drawers";
const OTG_TALL = "OTG / Microwave Tall Unit Cabinate With Shutter, Shelf & Tandem Drawer";

// Matched by a word in the file name.
const EXPECTED: Record<string, Expected> = {
  RIKEN: {
    units: [
      ...u(DIVIDER_2TD, 600, 635, 750), // drawn 560; quote 600 (rounding rule still open)
      ...u("Base Sink Unit Divider With Shutter", 900, 635, 750),
      ...u("Base Blind Unit Divider With Shutter", 1085, 635, 750),
      ...u(DIVIDER_3TD, 700, 635, 750, 2),
      ...u(DIVIDER_2TD, 700, 635, 750),
      ...u(OTG_TALL, 600, 600, 2300),
      // Wall units 370 deep as the plan says (the quote used 350; owner: always take the plan).
      ...u("Niche Unit With Self", 700, 370, 200),
      ...u("Wall Unit With Lift Up Profile Shutter", 700, 370, 375, 2),
      ...u("Wall Unit With Lift Up Shutter", 700, 370, 375, 4),
      ...u("Chimney Wall Unit With Lift Up Shutter", 700, 370, 375, 2),
    ],
    ledMm: 4200,
    trayMm: 700,
    cleaningAgent: false,
  },
  FALGUNI: {
    units: [
      ...u(DIVIDER_2TD, 780, 635, 750, 4),
      ...u(DIVIDER_3TD, 780, 635, 750, 2),
      ...u("Base L Corner Unit Divider With Shutter & Shelf", 1085, 1085, 750),
      ...u(DIVIDER_3TD, 815, 635, 750, 3),
      ...u("Base Unit Dish Washer Shutter", 600, 0, 850),
      // Wall C plan shows 675, the countertop depth: base cabinets 625 (the quote agrees); tall units 675.
      ...u("Base Sink Unit Divider With Shutter", 990, 625, 750),
      ...u(DIVIDER_2TD, 600, 625, 750, 2),
      ...u("Tall Unit Cabinet With Shutter & Shelf", 600, 675, 2350),
      ...u(OTG_TALL, 600, 675, 2350),
      ...u("Tall Unit Cabinate With Shutter, Shelf & Internal Tandem Drawer", 600, 675, 2350),
      ...u("Loft Unit With Shutter & Shelf", 1050, 675, 450),
      ...u("Base Unit Cabinet With 2 Tandem Drawers", 820, 620, 750, 2),
      ...u("Base Unit Cabinet With Profile Shutter & Shelf", 820, 420, 750, 2),
    ],
    ledMm: 3000,
    trayMm: 800,
    cleaningAgent: true,
  },
  KALPESH: {
    units: [
      ...u("Base Unit Divider With 2 Tandem Pull-Out", 350, 635, 750),
      ...u("Base Sink Unit Divider With Shutter", 900, 635, 750),
      ...u(DIVIDER_2TD, 600, 635, 750),
      ...u("Base Blind Unit Divider With Shutter", 1085, 635, 750),
      ...u(DIVIDER_3TD, 770, 635, 750, 3),
      ...u("Wall Unit With Shutter & Shelf", 450, 350, 725),
      ...u("Wall Unit With Shutter & Shelf", 900, 350, 725),
      ...u("Chimney Wall Unit With Shutter & Shelf", 900, 350, 725),
      // Glass lift-up wall unit with open shelves below; heights not dimensioned, read by scale.
      ...u("Wall Unit With Lift Up Profile Shutter", 730, 350, 320, 1, true),
      ...u("Niche Unit With Self", 730, 350, 405, 1, true),
      ...u("Crockery Unit With Profile Shutter & Shelf", 600, 600, 1455),
      ...u(OTG_TALL, 600, 600, 770),
      ...u("Base Unit Cabinet With Wicker Basket", 600, 600, 570),
      ...u("Tall Unit Cabinet With Shutter & Shelf", 600, 600, 2400),
      ...u("Loft Unit With Shutter & Shelf", 600, 600, 395),
      // M.Tall is only the 1150 rolling-shutter section; the 520 above is a loft. (The 325 part and the base
      // unit below aren't settled yet, so they show up as "extra" for now.)
      ...u("Tall Unit Cabinet With Rolling Shutter, Movento Tray & Shelf", 685, 600, 1150),
      ...u("Loft Unit With Shutter & Shelf", 685, 600, 520),
    ],
    ledMm: 7180,
    trayMm: 700,
    cleaningAgent: false,
  },
};

// Claude Opus 5.5 list prices, USD per million tokens (thinking is billed as output).
const usd = (input: number, output: number) => (input * 4 + output * 20) / 1e6;

// Pairs each expected unit with one drawn unit (exact first, then scaled heights within 30 mm).
function compare(want: Want[], got: Unit[]) {
  const left = [...got];
  const take = (match: (g: Unit) => boolean) => {
    const i = left.findIndex(match);
    if (i === -1) return false;
    left.splice(i, 1);
    return true;
  };
  const same = (w: Want, g: Unit) => g.type === w.type && g.w === w.w && g.d === w.d;
  const notExact = want.filter((w) => !take((g) => same(w, g) && g.h === w.h));
  const missing = notExact.filter((w) => !(w.approx && take((g) => same(w, g) && Math.abs(g.h - w.h) <= 30)));
  return { missing, extra: left };
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("Give one or more drawing PDF paths");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in .env.local");
  const prisma = new PrismaClient({ adapter: makeDbAdapter(process.env.DATABASE_URL) });
  const lists = await loadImportLists(prisma);
  await prisma.$disconnect();
  console.log(`${lists.unitTypes.length} unit types, ${lists.variants.length} variant rows, model ${DRAWING_MODEL}\n`);

  let total = 0;
  for (const file of files) {
    console.log(`=== ${basename(file)}`);
    const { draft, usage, model, ms } = await readDrawing(readFileSync(file), lists);
    const final = finalizeDraft(draft, lists);
    const cost = usd(usage.input_tokens + (usage.cache_creation_input_tokens ?? 0), usage.output_tokens);
    total += cost;

    console.log(`Spec: ${draft.spec.productType} | ${draft.spec.cabinetDescription} | variant "${draft.spec.variantIdText}" → ${final.spec.variant?.variantId ?? "?"} | ${draft.spec.handle} | ${draft.spec.tandemDrawerType} | ${draft.spec.hinges}`);
    for (const x of final.units) {
      console.log(`${String(x.order).padStart(3)} ${x.wall.padEnd(6)} ${x.unitType} ${x.width}×${x.depth}×${x.height}${x.flags.length ? `   ⚠ ${x.flags.join("; ")}` : ""}`);
    }
    console.log(`Excluded: ${draft.excluded.map((x) => `${x.label} (${x.reason})`).join(", ") || "none"}`);
    console.log(`LED ${final.ledMm} mm | cutlery tray ${final.cutleryTrayMm ?? "?"} | cleaning agent ${final.cleaningAgent ? "yes" : "no"}`);
    for (const f of final.flags) console.log(`⚠ ${f}`);

    const key = Object.keys(EXPECTED).find((k) => basename(file).toUpperCase().includes(k));
    if (key) {
      const want = EXPECTED[key];
      const got = final.units.map((x) => ({ type: x.unitType, w: x.width, d: x.depth, h: x.height }));
      const { missing, extra } = compare(want.units, got);
      console.log(`\nvs expected (${key}): ${want.units.length - missing.length}/${want.units.length} units match`);
      for (const m of missing) console.log(`  missing  ${label(m)}`);
      for (const e of extra) console.log(`  extra    ${label(e)}`);
      const check = (what: string, got: unknown, wanted: unknown) => console.log(`  ${got === wanted ? "ok  " : "DIFF"} ${what}: ${got} (expected ${wanted})`);
      check("LED mm", final.ledMm, want.ledMm);
      check("cutlery tray", final.cutleryTrayMm, want.trayMm);
      check("cleaning agent", final.cleaningAgent, want.cleaningAgent);
    }
    console.log(`\n${model}, ${(ms / 1000).toFixed(0)} s, ${usage.input_tokens} in / ${usage.output_tokens} out tokens, about $${cost.toFixed(2)} (₹${(cost * 85).toFixed(0)})\n`);
  }
  if (files.length > 1) console.log(`Total about $${total.toFixed(2)} (₹${(total * 85).toFixed(0)})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
