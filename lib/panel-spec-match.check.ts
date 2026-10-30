// Run: npx tsx lib/panel-spec-match.check.ts
import assert from "node:assert/strict";
import { findPanelSpec } from "./panel-spec-match";

const spec = (id: string, brand: string, length: number, height: number, product = "Antaro Tandem") => ({ id, brand, product, length, height });
const specs = [
  spec("blum550", "Blum", 550, 100),
  spec("blum500", "Blum", 500, 100),
  spec("blumNoSize", "Blum", 0, 0),
  spec("noBrand", "", 0, 0),
  spec("movento", "", 0, 0, "Movento"),
];
const find = (brand: string, l: number, h: number, product = "Antaro Tandem") => findPanelSpec(specs, brand, product, l, h)?.id;

assert.equal(find("Blum", 550, 100), "blum550"); // exact size wins
assert.equal(find("", 550, 100), "blum550"); // any brand: still the exact size
assert.equal(find("Blum", 450, 100), "blumNoSize"); // no exact size: Blum's spec without sizes beats the no-brand one
assert.equal(find("", 450, 100), "noBrand"); // any brand: the no-brand spec without sizes
assert.equal(find("Hettich", 450, 100), "noBrand"); // another brand: only the no-brand spec fits
assert.equal(find("Hettich", 550, 100), "noBrand"); // Blum's 550 spec isn't Hettich's
assert.equal(find("", 0, 0, "Movento"), "movento");
assert.equal(find("Blum", 0, 0, "Unknown"), undefined);
assert.equal(findPanelSpec([spec("blum550", "Blum", 550, 100)], "Blum", "Antaro Tandem", 450, 100), undefined); // nothing fits
console.log("panel spec match ok");
