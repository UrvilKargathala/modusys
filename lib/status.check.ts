// Run: npx tsx lib/status.check.ts
import assert from "node:assert";
import { jobMoveFor, nextStatuses, statusFlow } from "./status";

const move = (o: Partial<Parameters<typeof jobMoveFor>[0]>) => jobMoveFor({ ownFactory: true, isPi: false, created: false, dispatched: false, current: "in-production", ...o });

// The first Purchase Order made for the job moves Requirement Order (or Confirmed) → In Purchase; a later one changes nothing.
assert.equal(move({ created: true, current: "in-procurement" }), "in-production");
assert.equal(move({ created: true, current: "approved" }), "in-production");
assert.equal(move({ created: true, current: "in-production" }), null);
assert.equal(move({ created: true, current: "manufacturing" }), null);
// Own factory: making the PI moves In Purchase → In Production; the PI dispatched moves on to Dispatched; the PO dispatched does nothing.
assert.equal(move({ isPi: true, created: true }), "manufacturing");
assert.equal(move({ isPi: true, dispatched: true, current: "manufacturing" }), "dispatched");
assert.equal(move({ dispatched: true }), null);
// No factory: no In Production step; the PO dispatched moves In Purchase → Dispatched; a PI changes nothing.
assert.deepEqual(statusFlow(false), ["draft", "approved", "in-procurement", "in-production", "dispatched", "completed"]);
assert.equal(move({ ownFactory: false, dispatched: true }), "dispatched");
assert.equal(move({ ownFactory: false, isPi: true, created: true }), null);
// Forward only: a job already Dispatched or Completed, or a cancelled one, stays.
assert.equal(move({ isPi: true, created: true, current: "dispatched" }), null);
assert.equal(move({ ownFactory: false, dispatched: true, current: "completed" }), null);
assert.equal(move({ isPi: true, created: true, current: "cancelled" }), null);
// By hand, one step forward: Confirmed → Requirement Order → In Purchase → In Production (own factory) or Dispatched (no factory).
assert.ok(nextStatuses("approved").includes("in-procurement"));
assert.ok(!nextStatuses("approved").includes("in-production"));
assert.ok(nextStatuses("in-procurement").includes("in-production"));
assert.ok(nextStatuses("in-production").includes("manufacturing"));
assert.ok(nextStatuses("in-production", false).includes("dispatched"));
console.log("status ok");
