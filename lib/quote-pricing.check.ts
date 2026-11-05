// Run: npx tsx lib/quote-pricing.check.ts
import assert from "node:assert/strict";
import { hardwareQtyHint, resolveHardwareForUnit, unitQtyFactor } from "@/lib/quote-pricing";
import type { UnitTypeHardware } from "@/lib/mock/unit-type";

const unit = { width: 900, depth: 600, height: 750, qty: 1 };
const hw = (qtyFormula: string, extra: Partial<UnitTypeHardware> = {}): UnitTypeHardware => ({ id: "h", categoryId: "", hardwareItemId: "hi-1", qtyFormula, ...extra });

// Auto Populate keeps the formula as a note; the hover shows its working while it still gives the qty.
const resolved = resolveHardwareForUnit(hw("H/450"), unit);
assert.equal(resolved.qtyFormula, "2");
assert.equal(resolved.qtyNote, "H/450");
assert.equal(hardwareQtyHint(resolved, unit), "H/450 = 750/450 = 2");
// A unit qty above 1 shows the multiplication.
const twice = resolveHardwareForUnit(hw("H/450"), { ...unit, qty: 2 });
assert.equal(hardwareQtyHint(twice, { ...unit, qty: 2 }), "H/450 = 750/450 = 1.67 × 2 = 3");
// A plain number is not a formula; a qty typed over the formula hides the hover.
assert.equal(resolveHardwareForUnit(hw("4"), unit).qtyNote, undefined);
assert.equal(hardwareQtyHint({ ...resolved, qtyFormula: "5" }, unit), undefined);
// An older row (no note) uses the Unit Type's formula for the same item.
assert.equal(hardwareQtyHint(hw("2"), unit, [hw("H/450")]), "H/450 = 750/450 = 2");

// Auto Populate already put the unit Qty into the lines, so it counts once; hand-built lines count Qty times.
assert.equal(unitQtyFactor({ qty: 3, autoPopulated: true }), 1);
assert.equal(unitQtyFactor({ qty: 3, autoPopulated: false }), 3);
assert.equal(unitQtyFactor({ qty: 0 }), 1);

console.log("quote pricing ok");
