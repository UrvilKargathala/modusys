// Run: npx tsx lib/requirement-progress.check.ts
import assert from "node:assert";
import { requirementProgress, sentLines } from "./requirement-progress";
import type { PurchaseOrder } from "./purchase-order";

const po = (id: string, material: Partial<PurchaseOrder["material"]>, quoteId = "q1") => ({ id, quoteId, material } as PurchaseOrder);
const ids = ["a", "b", "c", "d"];

// Nothing sent: Pending, 0%.
assert.deepEqual(requirementProgress(ids, sentLines("ro1", "q1", [], ids)), { total: 4, sent: 0, pending: 4, pct: 0, status: "pending" });
// Two POs from Send to PO: 3 of 4 lines sent → Part Complete, 75%. A Proforma Invoice and another order's PO don't count.
const orders = [
  po("p1", { fromRequirement: { roId: "ro1", lines: ["a", "b"] } }),
  po("p2", { fromRequirement: { roId: "ro1", lines: ["c"] } }),
  po("pi", { proforma: true, fromRequirement: { roId: "ro1", lines: ["d"] } }),
  po("x", { fromRequirement: { roId: "ro2", lines: ["d"] } }, "q2"),
];
const sent = sentLines("ro1", "q1", orders, ids);
assert.equal(sent.get("a")?.id, "p1");
assert.equal(sent.get("c")?.id, "p2");
assert.deepEqual(requirementProgress(ids, sent), { total: 4, sent: 3, pending: 1, pct: 75, status: "part" });
// Every line sent → Full Complete. A PO made for the quote before Send to PO (no line list) holds every line.
assert.equal(requirementProgress(ids, sentLines("ro1", "q1", [...orders, po("p3", { fromRequirement: { roId: "ro1", lines: ["d"] } })], ids)).status, "full");
assert.equal(requirementProgress(ids, sentLines("ro1", "q1", [po("old", {})], ids)).status, "full");
// An order with nothing that can be sent stays Pending.
assert.equal(requirementProgress([], new Map()).status, "pending");
console.log("requirement ok");
