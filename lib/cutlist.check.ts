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
// Cuts: one 2200 x 580 panel on a 2440 x 1220 sheet (kerf 3) is cut across the full width at y=580, then the strip at x=2200; two offcuts are left.
const one = packSheets([part("a", 2200, 580)], 2440, 1220, 3, false).sheets[0];
assert.deepEqual(one.cuts.map(({ dir, at, len }) => ({ dir, at, len })), [{ dir: "y", at: 580, len: 2440 }, { dir: "x", at: 2200, len: 580 }]);
assert.equal(one.cuts[1].label, "a");
assert.deepEqual(one.offcuts, [{ x: 2203, y: 0, w: 237, h: 580 }, { x: 0, y: 583, w: 2440, h: 637 }]);
// A piece that fills the sheet needs no cut.
assert.equal(packSheets([part("full", 2440, 1220)], 2440, 1220, 3, false).sheets[0].cuts.length, 0);
// Every piece but the last-fitting one costs a cut; no cut is longer than the sheet or lies outside it; each cut that frees a piece names it.
for (const s of r.sheets) {
  assert.ok(s.cuts.length >= s.placed.length - 1);
  for (const c of s.cuts) assert.ok(c.len > 0 && c.len <= 2440 && c.at > 0 && c.at < (c.dir === "x" ? 2440 : 1220));
  assert.equal(s.cuts.filter((c) => c.label).length, s.placed.filter((p) => p.w < 2440 || p.h < 1220).length);
}
console.log("cutlist ok");
