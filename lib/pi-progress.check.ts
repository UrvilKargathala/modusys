// Run: npx tsx lib/pi-progress.check.ts
import assert from "node:assert/strict";
import { nextWorkOrderNo, piProgress, poDoneByPis, withWorkOrder, woProgress, workOrderView, workOrdersOf } from "@/lib/pi-progress";
import type { PurchaseOrder } from "@/lib/purchase-order";

const line = (lineKey: string) => ({ id: `row-${lineKey}`, lineKey }) as PurchaseOrder["lines"][number];
const order = (id: string, keys: string[], extra: Partial<PurchaseOrder["material"]> = {}, status = "pending") =>
  ({ id, poNumber: id.toUpperCase(), status, lines: keys.map(line), material: extra }) as unknown as PurchaseOrder;

const po = order("po1", ["a", "b", "c", "d"]);
const delivered = (pi: PurchaseOrder) => pi.status === "delivered";

// Nothing sent yet.
assert.deepEqual({ ...piProgress(po, [po]), sent: undefined }, { sent: undefined, total: 4, sentCount: 0, pct: 0, status: "pending" });
assert.equal(poDoneByPis(po, [po], delivered), false);

// Two of four lines on PI-1 (its own extra line "z" doesn't count); a PI of another PO doesn't count.
const pi1 = order("pi1", ["a", "b", "z"], { proforma: true, fromPoId: "po1" }, "delivered");
const other = order("pi9", ["c"], { proforma: true, fromPoId: "po2" }, "delivered");
const p = piProgress(po, [po, pi1, other]);
assert.equal(p.status, "part");
assert.equal(p.pct, 50);
assert.equal(p.sent.get("a"), "PI1");
assert.equal(p.sent.has("c"), false);
// Half sent: not finished even though PI-1 is dispatched.
assert.equal(poDoneByPis(po, [po, pi1, other], delivered), false);

// The rest on PI-2: full; finished only once PI-2 is dispatched too.
const pi2 = order("pi2", ["c", "d"], { proforma: true, fromPoId: "po1" });
assert.equal(piProgress(po, [po, pi1, pi2]).status, "full");
assert.equal(poDoneByPis(po, [po, pi1, pi2], delivered), false);
assert.equal(poDoneByPis(po, [po, pi1, { ...pi2, status: "delivered" }], delivered), true);

// An older whole-PO PI (lines without this PO's keys) finishes the PO once dispatched, as before.
const legacy = order("pi0", ["x1", "x2"], { proforma: true, fromPoId: "po1" }, "delivered");
assert.equal(poDoneByPis(po, [po, legacy], delivered), true);

console.log("pi progress ok");

// Send to Work Order: each send is its own Work Order; progress counts the lines on any of them. An older PI In Production has one
// Work Order of every line.
const wo = (id: string, no: string, lines: string[]) => ({ id, no, date: "2026-10-31", lines });
const pi3 = order("pi3", ["a", "b", "c", "d"], { proforma: true, workOrders: [wo("w1", "PWO-1", ["a"]), wo("w2", "PWO-2", ["c"])] });
assert.equal(woProgress(pi3).status, "part");
assert.equal(woProgress(pi3).sent.get("c"), "PWO-2");
assert.deepEqual(workOrderView(pi3, pi3.material.workOrders![1]).lines.map((l) => l.lineKey), ["c"]);
assert.equal(woProgress(order("pi4", ["a", "b"], { proforma: true })).status, "pending");
assert.equal(woProgress(order("pi5", ["a", "b"], { proforma: true }, "in-production")).status, "full");
assert.equal(workOrdersOf(order("pi6", ["a", "b"], { proforma: true }, "in-production"))[0].lines.length, 2);
// Saving one Work Order leaves the other alone.
const m = withWorkOrder(pi3, "w2", { no: "PWO-9", state: { usedEdgeBand: {} } });
assert.deepEqual(m.workOrders!.map((w) => w.no), ["PWO-1", "PWO-9"]);
// A status on an older PI's one Work Order makes it a Work Order of its own, keeping its lines.
const legacyWo = withWorkOrder(order("pi7", ["a", "b"], { proforma: true }, "in-production"), "", { status: "manufacturing" }).workOrders!;
assert.deepEqual([legacyWo.length, legacyWo[0].status, legacyWo[0].lines.length], [1, "manufacturing", 2]);
console.log("work order progress ok");

// Production Work Order numbers count per day and product type code, across PIs and their Work Orders.
assert.equal(nextWorkOrderNo("2026-10-31", "KT", []), "PWO-311026-KT-01");
assert.equal(nextWorkOrderNo("2026-10-31", "KT", [order("x", [], { workOrders: [wo("1", "PWO-311026-KT-01", []), wo("2", "PWO-311026-KT-07", [])] }), order("y", [], { workOrderNo: "PWO-311026-WR-09" })]), "PWO-311026-KT-08");
assert.equal(nextWorkOrderNo("2026-10-31", undefined, []), "PWO-311026-01");
console.log("work order number ok");
