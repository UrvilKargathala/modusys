// Run: npx tsx lib/cutlist.check.ts
import assert from "node:assert";
import { packSheets, placedEdges, type Part } from "./cutlist";

const off = { top: { on: false, code: "" }, bottom: { on: false, code: "" }, lh: { on: false, code: "" }, rh: { on: false, code: "" } };
const part = (id: string, w: number, h: number): Part => ({ id, label: id, w, h, sides: off });

// Four 1220 x 610 pieces tile one 2440 x 1220 sheet with no kerf; with a 3 mm kerf no two fit together (1220 + 3 + 1220 > 2440), so 4 sheets.
const tight = packSheets([part("a", 1220, 610), part("b", 1220, 610), part("c", 1220, 610), part("d", 1220, 610)], 2440, 1220, 0, false);
assert.equal(tight.sheets.length, 1);
assert.equal(tight.unfit.length, 0);
const kerfed = packSheets([part("a", 1220, 610), part("b", 1220, 610), part("c", 1220, 610), part("d", 1220, 610)], 2440, 1220, 3, false);
assert.equal(kerfed.sheets.length, 4);

// No two pieces on a sheet overlap, and every piece stays inside the sheet.
const many = Array.from({ length: 40 }, (_, i) => part(`p${i}`, 200 + ((i * 97) % 500), 150 + ((i * 53) % 400)));
const r = packSheets(many, 2440, 1220, 3, true);
assert.equal(r.unfit.length, 0);
assert.equal(r.sheets.reduce((n, s) => n + s.placed.length, 0), 40);
for (const s of r.sheets) {
  for (const a of s.placed) {
    assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= 2440 && a.y + a.h <= 1220);
    for (const b of s.placed) if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }
}

// Too big for the sheet (and not rotatable into it) is reported, not dropped.
assert.equal(packSheets([part("big", 3000, 100)], 2440, 1220, 3, true).unfit.length, 1);

// Rotated pieces move their banded sides: the old left edge ends up on top.
const e = placedEdges({ part: { ...part("x", 1, 1), sides: { ...off, lh: { on: true, code: "E1" } } }, x: 0, y: 0, w: 1, h: 1, rot: true });
assert.equal(e.top.code, "E1");
console.log("cutlist ok");
