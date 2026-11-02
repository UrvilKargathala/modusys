import assert from "node:assert/strict";
import { buildPoNumber } from "./purchase-order";

// Run with: npx tsx lib/purchase-order.check.ts
const old = ["PO-MAPA-01", "TEST-PO-001", ""]; // numbers in the old style neither count nor clash
assert.equal(buildPoNumber({ customer: "mapa", type: "kt" }, old), "0001/MAPA-KT-01");
// The running number goes up across every PO; the id only across the same customer and type.
const some = ["0015/TEPA-KT-01", "0016/MAPA-KT-01", "0016/MAPA-KT-02"];
assert.equal(buildPoNumber({ customer: "MAPA", type: "KT" }, some), "0017/MAPA-KT-03");
assert.equal(buildPoNumber({ customer: "MAPA", type: "WR" }, some), "0017/MAPA-WR-01");
assert.equal(buildPoNumber({ customer: "TEPA" }, ["0003/TEPA-04"]), "0004/TEPA-05");
assert.equal(buildPoNumber({}, ["0009/01"]), "0010/02");
console.log("purchase order number ok");
