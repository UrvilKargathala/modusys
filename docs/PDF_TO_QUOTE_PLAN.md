# Drawing PDF → draft quote plan

Status: **Phase 1 code written on branch `pdf-quote-import` (25/11/2026), not yet run against Claude.**
Rules agreed with the owner on 25/11/2026 after checking 4 real drawing + quote sets by hand.

## Goal
Staff upload a The Furn kitchen drawing PDF and get a draft quote: Material Specification filled in and
every unit added with its Unit Type and W × D × H, in room order. Staff check the flagged lines, then the
existing Auto Populate fills each unit's parts, hardware and prices. Today all of this is typed by hand
from the drawing.

## Today
- Staff read the layout (L1.01) and elevations (E1.01-A/B/C/D) and type every unit into Quotes → New.
- Each unit: pick space → Unit Type → type W, D, H, Qty → **Auto Populate**
  (`runAutoPopulate` in `web/components/quotes/create/quote-unit-card.tsx`, which calls
  `buildCabinetsFromUnitType` in the same file). Auto Populate already turns the Unit Type's formulas
  into parts, hardware and rates (`shared/quote-pricing.ts`). **The import does not touch this part.**
- Hand-made quotes contain mistakes. The 4 test sets had a wrong blind width, three wrong drawer widths,
  a wrong L-corner size and one unit in the wrong space.

## What the drawings look like
- The Furn's own standard only (designers: Devangee Sailor, Vipul Dodiya). Other architects' drawings are
  out of scope.
- A3 or A4, 3–5 pages, made in CAD and exported through iLovePDF. **They have a real text layer**: every
  label and dimension number can be read exactly. Some letters drop out ("Mr. alpeshbhai"), so names are
  never taken from the drawing.
- Page 1 is the layout with the Material Specification table; the next pages are elevations.

## Design

```
Quotes → New → "Import from drawing" → pick PDF
  → POST /api/quotes/import-drawing (PDF + who is asking)
      1. load the allowed lists from the DB: active Unit Types, Material Library options
         (product type, cabinet description, handle, tandem, hinges, space), Variant IDs
      2. one Claude call: rules (below) + lists + the PDF → draft JSON (schema below)
      3. code clean-up: round widths, cutlery tray, LED total, map names to ids, checks → flags
  → review dialog: header picks + one row per unit, flags in red, every field editable
  → "Create quote" → Quotes → New, prefilled; each unit run through the same Auto Populate
  → staff finish as today (customer, property type, executives, discount) and save
```

### The Claude call
- SDK `@anthropic-ai/sdk` (new dependency, approved 25/11/2026), model `claude-opus-5-5`, effort `high`,
  streaming with `finalMessage()` (a drawing can take 30–90 s).
- PDF sent as a base64 `document` block (limit 32 MB per request; our PDFs are 1–6 MB).
- Output forced to our JSON with structured outputs (`output_config.format`, Zod schema, repo already
  uses Zod). Unit Type names, spaces and spec options go in as **enums built from the DB**, so the model
  can only answer with names that exist.
- Refusal fallback on (`fallbacks: "default"`), as recommended for this model.
- Cost: roughly $0.30–0.70 (₹25–60) per drawing, to be measured in Phase 1.
- No queue (BullMQ): one request per drawing is enough.

### Draft JSON (what Claude returns)
```
spec:   { productType, cabinetDescription, variantIdText, handle, tandemDrawerType, hinges }
units:  [{ order, wall, label (as written on the drawing), unitTypeName, space,
           width, depth, height, sources: ["L1.01", "E1.01-B"], note }]
ledStrips: [{ where, orientation: "horizontal" | "vertical", lengthMm }]
hobDrawerUnitWidth, detergentPullOut, cleaningAgentMentioned
flags:  [{ unitOrder?, message }]
```
Code, not the model, does the arithmetic: rounding, LED total, tray size, wall-length checks.

### Checks (code, after the call)
- Every unit appears in an elevation; layout-only units are flagged and left out.
- Tall unit over 2400 → flag (should the top be a loft?).
- Widths rounded by code → flag, so staff see the drawn size.
- Deferred: checking that unit widths add up to each wall's overall dimension. Add it if a test run shows
  a missed or doubled unit.
- Variant ID text matches exactly one price row, else flag and let staff pick.
- Height missing in the drawing and read by scale → flag "scaled".
- Any unit whose label and elevation disagree → flag.

## Rules (agreed)

**Material Specification**
1. Match each value exactly to the Material Library options. Variant ID must be the exact price-list
   code. Free text such as "Technomatt-18mm-Birch" matches 2 rows → flag. Designers will write exact codes.
2. Staff always pick: customer (from CRM), property type, designer, sales and site executives.

**Units**

3. Unit Type from the label plus the elevation. The elevation wins: glass frames drawn → Profile type;
   drawer count from drawer lines or drawer labels (two stacked = 2 Tandem, three = 3 Tandem).
4. Semi-modular → Divider units; full modular → Cabinet units. Tall units are always Cabinet. Island
   units are always Cabinet, even in semi-modular.
5. Width as drawn; odd sizes round **up** to the next 50 (691 → 700). The code rounds only widths that
   aren't a multiple of 5, and flags them. Owner 26/11/2026: fine even when it overshoots the wall
   (three 523 units → 550 each).
6. Depth as drawn in the plan, never from a side view in an elevation. Base cabinets: when the plan gives
   the countertop depth (685, with the top's 50 overhang), the cabinet is 50 less (635); corner widths use
   the cabinet depth.
7. Height from the elevation chain; when not dimensioned, read it by scale.
8. Sink = the sum of its shutters as measured (450 + 450 = 900).
9. Blind corner W = visible shutter + base depth (450 + 635 = 1085). L-corner = 450 + 635 each way
   (no extra 20). Add the LeMans tray hardware only when the layout says LeMans.
10. Stacked wall rows are separate units (two 375 lift-up rows = 2 units). Both rows over the hob are
    Chimney units. Units inside the wall-unit band are wall units even when labelled loft; open shelves
    beside or below them are a niche unit. Lofts sit above the wall-unit band, tall units or the fridge.
11. Split a tall unit only when its shutter itself is over 2400; the part above becomes Loft Unit With
    Shutter & Shelf. An oven tall unit 2650 high with a 1650 shutter stays one unit (owner, 26/11/2026). Oven tall unit with a profile shutter splits into Crockery Unit With
    Profile Shutter & Shelf (glass part) + OTG / Microwave Tall Unit + Base Unit Cabinet With Wicker
    Basket. Wicker baskets inside a solid-shutter tall unit are hardware, not a separate unit.
    A rolling-shutter unit (M.TALL) is only its rolling-shutter section on the counter; the part above
    and the base unit below are separate units.
12. Dishwasher = Base Unit Dish Washer Shutter, depth 0, height = counter height.
13. Only units shown in the elevations count. Left out: appliances, fillers (20 / 50), gas-line
    packing, on-site partitions and civil work, stone and breakfast counters.
14. One row per unit, qty 1, never merged into qty N. Order: walk the room wall by wall, then island,
    then Kitchen Accessories and Light Unit.

**Extras**

15. Kitchen Accessories: the standard set on every kitchen. Cutlery tray = width of the drawer unit under
    the hob, rounded **down** to 100 (900 → 900, 815 → 800, 770 → 700). Kessebohmer Cleaning Agent 300mm
    only when the drawing says "Detergent Pull Out".
16. Light Unit LED (mm) = the sum of the yellow glow strips. A horizontal strip counts the rounded unit
    width; nothing under the hood. The glow along the top inside each glass cabinet is a strip of its
    own, and each lit glass cabinet has a vertical strip on **both** sides (2 × its height). Spot lights
    are counted from the drawing (owner, 26/11/2026).
17. Visible (exposed side) panels: staff add them by hand. Designers will mark them on the drawing; when
    marked, the import puts a "Visible panel" check on that unit (it doesn't add the panel itself).
18. Depth varies site to site (wall units 350 on one job, 370 on another): always the plan's figure.
19. Profile glass cabinets keep their own rates (owner, 26/11/2026). When the Variant ID is Technomatt (or
    any solid shutter finish) and a unit is a profile glass cabinet, its glass shutter is not re-priced to
    the Variant's rate (₹725); it keeps the profile glass rate (staff use ₹900), and its internal carcass
    rates are the profile glass cabinet's rates too. Not built yet: today both the import and the unit
    card's Auto Populate re-price glass shutters to the Variant's rate, so staff fix them by hand.

## Test cases
Files are in the owner's Downloads. "Expected" = what the import must produce; it is what the owner
confirmed, not always the hand-made quote.

| Set | Type | Files | Expected | Status |
|---|---|---|---|---|
| Kalpeshbhai | Semi | KALPESHBHAI-KITCHEN.pdf | 20 rows, LED 7180 | No matching quote (quote is an older design) |
| Riken Patel | Semi | RIKENBHAI-ELEVATION (1).pdf + PI...Riken Patel-KT.pdf | 18 rows, LED 4200 | 18/18 after 2 quote mistakes confirmed |
| Falguni Desai | Semi | FALGUNI DESAI-KITCHEN ELEVATION.pdf + REV PI...Mrs Falguni Desai - KT.pdf | 24 rows, LED 3000 | 24/24 types and sizes; quote depths and L-corner differ from the rules |
| Rinkubhai | Full | RINKUBHAI-ELEVATION.pdf + Rinkubhai - Modular KT.pdf | 19 types match | **Drawing (19/11) newer than quote (26/10): need the matching pair** |
| — | Full | — | — | **Second full-modular set still needed** |

**Riken (expected)**: 2 Tandem Divider 600×635×750 · Sink Divider 900×635×750 · Blind Divider 1085×635×750 ·
3 Tandem 700 · 2 Tandem 700 · 3 Tandem 700 (all ×635×750) · OTG / Microwave Tall Unit With Shutter, Shelf &
Tandem Drawer 600×600×2300 (+2 wicker baskets) · Niche Unit With Self 700×370×200 · Wall Unit With Lift Up
Profile Shutter ×2, Wall Unit With Lift Up Shutter ×4, Chimney Wall Unit With Lift Up Shutter ×2
(all 700×350×375) · Kitchen Accessories (tray 700) · LED 4200.

**Falguni (expected)**: wall A 2 Tandem ×4 + 3 Tandem ×2 (780×635×750) · L-Corner Divider 1085×1085×750 ·
wall B 3 Tandem ×3 (815×635×750) · Dish Washer Shutter 600×0×850 · Sink Divider 990 · 2 Tandem ×2 600 ·
Tall Shutter & Shelf, OTG / Microwave Tall, Tall Internal Tandem (600 × plan depth × 2350) · Loft above
fridge 1050 × plan depth × 450 (scaled) · island 2 Tandem Cabinet ×2 820 and Profile Shutter & Shelf
Cabinet ×2 820 (plan depths 620 / 420) · Kitchen Accessories (tray 800, Cleaning Agent) · LED 3000.

**Kalpeshbhai (expected)**: 2 Tandem Pull-Out 350 · Sink 900 · 2 Tandem 600 · Blind 1085 · 3 Tandem 770 ×3
(all Divider ×635×750) · Wall Unit Shutter & Shelf 450 and 900 · Chimney Wall Unit 900 (×350×725) · Loft
Lift Up Profile 730×350×520 · Niche 730×350×325 (type flagged) · Crockery Profile 600×600×1455 · OTG Tall
with Tandem 600×600×770 · Base Wicker Basket Cabinet 600×600×570 · Tall Shutter & Shelf 600×600×2400 +
Loft 600×600×395 · Tall Rolling Shutter 685×600×1150 · Kitchen Accessories (tray 700) · LED 7180.

## Phases

**Phase 0: before any code (owner + one read)**
- One matched full-modular drawing + quote pair (Rinkubhai's matching version, or another).
- LeMans tray added to the Hardware Price List (owner).
- ✅ 25/11/2026: owner chose `@anthropic-ai/sdk` over plain `fetch`, and OK to send drawings to the
  Claude API. Still needed: an `ANTHROPIC_API_KEY` from the owner's Anthropic Console account, in
  `.env.local` for testing (never committed) and in Coolify before release.
- Read the production Unit Type list (read-only). The staging copy is behind: it has no
  "Chimney Hanging Unit".

**Phase 1: extraction only, no UI** (code written 25/11/2026, `npm run check` passes)
- ✅ `shared/drawing-import.ts`: the rules prompt, Zod schema (DB lists as enums), clean-up and checks
  (rounding, LED total, cutlery tray, Variant ID matching, flags). No server imports.
- ✅ `backend/server/drawing-import.ts`: loads the lists from the DB and makes the one Claude call.
- ✅ `shared/drawing-import.check.ts`: free check of the clean-up, `npx tsx shared/drawing-import.check.ts` (keep-alive: `npx tsx backend/server/keep-alive-json.check.ts`).
- ✅ `backend/scripts/drawing-import-test.ts`: runs real PDFs and prints draft vs expected, time and cost.
  **Costs money each run → ask before running.** `npx tsx backend/scripts/drawing-import-test.ts <pdf> ...`
- ✅ First paid run 25/11/2026 (₹67 for 3 drawings, 71–120 s each, ₹17–27 per drawing):
  Falguni 22/22 units, LED, tray and cleaning agent all right. Riken: unit types all right, sizes off on
  depth (wall B base 685 vs 635, wall units 370 vs 350, niche 200 from an elevation section) and LED
  3500 vs 4200. Kalpeshbhai: 15/18; the 730 loft/niche and the M.Tall height differ, LED 6450 vs 7180.
  Fixed in the prompt: depth only from the plan; count the glow inside the top of glass cabinets
  (the missed LED strip in both Riken and Kalpeshbhai). Depth and M.Tall questions sent to the owner.
- Done when: Riken and Falguni match their expected lists, and every known problem in Kalpeshbhai and
  Rinkubhai shows up as a flag. Measured time and cost per drawing are written down here.

**Phase 2: import in the app** (code written 25/11/2026, `npm run check` passes)
- ✅ `web/app/api/quotes/import-drawing/route.ts`: any signed-in user (same as saving quotes); PDF only, 20 MB
  cap; 20 drawings per person per hour; errors go to the error log with a code shown to the user.
- ✅ `web/components/quotes/import-drawing-dialog.tsx` + "Import from drawing" button on Quotes → New (new
  quotes only): upload, a seconds counter while reading, review (spec, units with flags, warnings, what
  was left out), **Fill quote**. Fill sets the Material Specification and replaces the units; each unit is
  Auto Populated with the quote's shutter finish, flags go in the unit's Remark, Kitchen Accessories keeps
  only the right cutlery tray (+ Cleaning Agent when asked), Light Unit's LED qty = the LED total.
  Ctrl+Z brings the old units back. Nothing is saved until Save Quote.
- ✅ Auto Populate moved to `web/lib/auto-populate.ts`; the unit card's button uses the same function.
- ✅ Checked in the browser: button and dialog show; the route refuses no file, a non-PDF, and signed-out.
- ✅ End to end in the browser 25/11/2026 with a new drawing (Dharmikbhai, 5 sheets, semi-modular):
  read in 260 s, 39 units + Kitchen Accessories + Light Unit filled and Auto Populated, Final Offer
  worked out (₹5,94,290 before the Variant ID was picked), LED 9155 mm on the Light Unit, only the
  700 cutlery tray kept, flags in each unit's Remark, 19 points to check. Nothing saved.
- Wait text changed to 1–5 minutes and the route's time limit raised to 600 s.
- ✅ Long requests 26/11/2026: the server's proxy is Caddy (no response time limit), but Cloudflare in
  front of modusys.co.in cuts a request that sends nothing for 100 s (error 524). The route now answers
  at once and sends a space every 15 s until the JSON is ready (backend/server/keep-alive-json.ts). Staging
  has no domain, so it can't show this; check it on the live site after release.
- ⏳ Before release: commit; the release steps (CLAUDE.md §6).

**Phase 3: later, only if wanted**
- Keep the drawing PDF on the quote (Garage + one new column, an additive DB change, needs its own plan).
- Log per import: time, cost, how many lines staff changed, to see where the rules miss.

## Not doing
- Building a second parts/BOM engine (Unit Type templates + Auto Populate already do it).
- Drawings in other architects' styles, scanned or photographed drawings.
- Wardrobes and bedrooms (kitchens first; the same flow can follow).
- Filling customer, property type or executives from the drawing.

## Open questions
- Price check 26/11/2026, Dharmikbhai vs the live staff quote QT-311026-01(D): with the same Variant ID
  and markup (2.5) our draft was ₹16,29,074 against ₹15,87,963 (+2.6%). Compare on live data only;
  the staging copy is a month old (older price list, no Technomatt rows, different default markup).
  Remaining gaps are staff edits to template contents (loft side panels, Tip-On), the lower niche row
  (sliding niches), Kitchen Accessories swaps, and the glass shutter rate (picking a Technomatt Variant
  ID also re-prices glass shutters at ₹725; staff priced them ₹900). That last one also happens with
  the unit card's Auto Populate.
