// Run: npx tsx lib/accounts.check.ts
import assert from "node:assert";
import { accountMoves, closingBalance, entrySchema, groupTotals, totals } from "./accounts";

// The guide's own example: Cash 10,000 + 35,000 - 7,000 = 38,000; Bank 1,00,000 + 50,000 - 25,000 = 1,25,000.
const rows = [
  { type: "income", accountId: "bank", toAccountId: null, amount: 50000, head: "Customer Advance" },
  { type: "income", accountId: "cash", toAccountId: null, amount: 35000, head: "Other Income" },
  { type: "expense", accountId: "bank", toAccountId: null, amount: 25000, head: "Staff Salary" },
  { type: "expense", accountId: "cash", toAccountId: null, amount: 7000, head: "Office Expenses" },
];
let m = accountMoves(rows);
assert.equal(closingBalance(10000, m.get("cash")), 38000);
assert.equal(closingBalance(100000, m.get("bank")), 125000);
assert.deepEqual(totals(rows), { income: 85000, expense: 32000, net: 53000, count: 4 });

// A Cash -> Bank transfer moves both balances but never touches income / expense.
const withTransfer = [...rows, { type: "transfer", accountId: "cash", toAccountId: "bank", amount: 5000, head: "" }];
m = accountMoves(withTransfer);
assert.equal(closingBalance(10000, m.get("cash")), 33000);
assert.equal(closingBalance(100000, m.get("bank")), 130000);
assert.deepEqual(totals(withTransfer), { income: 85000, expense: 32000, net: 53000, count: 5 });
assert.equal(closingBalance(500, undefined), 500);

// Paise stay exact (0.1 + 0.2 is not 0.30000000000000004).
assert.equal(totals([{ type: "income", amount: 0.1 }, { type: "income", amount: 0.2 }]).income, 0.3);

// Grouping skips transfers.
assert.deepEqual(groupTotals(withTransfer, (r) => r.type).map((g) => [g.key, g.net]), [["income", 85000], ["expense", -32000]]);

// Form rules: income needs a head and a mode, transfers need a different target account, amount > 0 with up to 2 decimals.
const ok = { date: "2026-11-09", type: "income", headId: "h", accountId: "cash", amount: "50000", paymentMode: "UPI" };
assert.equal(entrySchema.safeParse(ok).success, true);
assert.equal(entrySchema.safeParse({ ...ok, headId: "" }).success, false);
assert.equal(entrySchema.safeParse({ ...ok, paymentMode: "" }).success, false);
assert.equal(entrySchema.safeParse({ ...ok, amount: "0" }).success, false);
assert.equal(entrySchema.safeParse({ ...ok, amount: "-5" }).success, false);
assert.equal(entrySchema.safeParse({ ...ok, amount: "10.555" }).success, false);
assert.equal(entrySchema.safeParse({ ...ok, type: "transfer", headId: "", paymentMode: "", toAccountId: "cash" }).success, false);
assert.equal(entrySchema.safeParse({ ...ok, type: "transfer", headId: "", paymentMode: "", toAccountId: "bank" }).success, true);

console.log("accounts.check: ok");
