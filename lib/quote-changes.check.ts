// Run: npx tsx lib/quote-changes.check.ts
import assert from "node:assert/strict";
import { blankQuote, type Quote, type QuoteUnit } from "@/lib/mock/quote";
import { quoteChanges } from "@/lib/quote-changes";

const names: Record<string, string> = { h1: "Hettich", h2: "Blum", sp: "Kitchen", ut: "BUD3TD" };
const nameOf = (id: string) => names[id] ?? "";
const finalOf = (q: Quote) => q.units.reduce((s, u) => s + u.qty * 1000, 0);
const unit = (id: string, patch: Partial<QuoteUnit> = {}): QuoteUnit => ({
  id, spaceId: "sp", unitTypeId: "ut", width: 600, depth: 560, height: 720, qty: 1, autoPopulated: false, collapsed: false,
  cabinets: [{ id: `${id}-c`, cabinetTypeId: "", label: "", components: [], externalFinishes: [], hardware: [], panels: [] }],
  remark: "", ...patch,
});

const before: Quote = { ...blankQuote("Q-1", 1), handleTypeId: "h1", units: [unit("u1"), unit("u2")] };

assert.deepEqual(quoteChanges(before, before, nameOf, finalOf), []);
// UI-only state is not a change.
assert.deepEqual(quoteChanges(before, { ...before, units: before.units.map((u) => ({ ...u, collapsed: true })) }, nameOf, finalOf), []);

const after: Quote = {
  ...before,
  handleTypeId: "h2",
  specialDiscountPct: 5,
  units: [unit("u1", { width: 800, qty: 2 }), unit("u3")],
};
assert.deepEqual(quoteChanges(before, after, nameOf, finalOf), [
  "Handle: Hettich → Blum",
  "Special Discount: 0% → 5%",
  "Unit removed: 2. Kitchen — BUD3TD",
  "Unit 1. Kitchen — BUD3TD: Width 600 → 800, Qty 1 → 2",
  "Unit added: 2. Kitchen — BUD3TD",
  "Final Amount: ₹2,000.00 → ₹3,000.00",
]);

assert.deepEqual(quoteChanges(before, { ...before, units: [before.units[1], before.units[0]] }, nameOf, finalOf), ["Units reordered"]);

// Rows re-made with new ids but the same contents (Auto Populate) are not a change; a changed rate is.
const row = (id: string, rate?: number) => ({ id, articleNo: "A1", qty: 1, ...(rate ? { rateOverride: rate } : {}) });
const withHw = (rows: ReturnType<typeof row>[]): Quote => ({
  ...before,
  units: [{ ...before.units[0], cabinets: [{ ...before.units[0].cabinets[0], hardware: rows as never }] }, before.units[1]],
});
assert.deepEqual(quoteChanges(withHw([row("a")]), withHw([row("b")]), nameOf, finalOf), []);
assert.deepEqual(quoteChanges(withHw([row("a")]), withHw([row("b", 99)]), nameOf, finalOf), ["Unit 1. Kitchen — BUD3TD: Hardware changed"]);

console.log("quote changes ok");
