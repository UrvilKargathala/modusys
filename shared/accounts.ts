import { z } from "zod";

// Daily income & expense book: shared lists, the entry form rules (client and API) and the money maths.
// Closing balance = opening + income - expense + transfers in - transfers out. Sums run in paise so they stay exact.

export const ENTRY_TYPES = ["income", "expense", "transfer"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];
export const TYPE_LABEL: Record<string, string> = { income: "Income", expense: "Expense", transfer: "Transfer" };

export const PAYMENT_MODES = ["Cash", "Bank Transfer / NEFT / RTGS", "UPI", "Cheque", "Card"] as const;

export const ACCOUNT_KINDS = [
  ["cash", "Cash"],
  ["bank", "Bank account"],
  ["petty-cash", "Petty cash"],
  ["card", "Card"],
  ["other", "Other"],
] as const;
export const ACCOUNT_KIND_LABEL: Record<string, string> = Object.fromEntries(ACCOUNT_KINDS);

export const PARTY_TYPES = ["customer", "vendor", "dealer", "employee"] as const;
export const PARTY_LABEL: Record<string, string> = { customer: "Customer", vendor: "Vendor", dealer: "Dealer", employee: "Employee" };

// from / to from the URL, defaulting to this month so far; swapped if given backwards.
export function pickRange(sp: { from?: string; to?: string }, today: string) {
  const ok = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  let from = ok(sp.from) ? sp.from : `${today.slice(0, 8)}01`;
  let to = ok(sp.to) ? sp.to : today;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

export const entryNoLabel = (n: number) => `TXN-${String(n).padStart(6, "0")}`;
export const ddmmyyyy = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
export const entrySchema = z
  .object({
    date,
    type: z.enum(ENTRY_TYPES),
    headId: z.string().default(""),
    accountId: z.string().min(1, "Pick the payment account"),
    toAccountId: z.string().default(""),
    amount: z.coerce.number({ error: "Enter the amount" }).gt(0, "Amount must be more than zero").max(999_999_999_999, "Amount is too large"),
    paymentMode: z.string().default(""),
    partyType: z.enum(["", ...PARTY_TYPES]).default(""),
    partyId: z.string().default(""),
    partyName: z.string().trim().max(120).default(""),
    remarks: z.string().trim().max(500).default(""),
    attachmentKey: z.string().default(""),
    attachmentName: z.string().max(200).default(""),
  })
  .superRefine((v, ctx) => {
    if (!/^\d+(\.\d{1,2})?$/.test(String(v.amount))) ctx.addIssue({ code: "custom", path: ["amount"], message: "Up to 2 decimals (paise)" });
    if (v.type === "transfer") {
      if (!v.toAccountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Pick the account the money goes to" });
      else if (v.toAccountId === v.accountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Pick a different account" });
    } else {
      if (!v.headId) ctx.addIssue({ code: "custom", path: ["headId"], message: "Pick the account head" });
      if (!v.paymentMode) ctx.addIssue({ code: "custom", path: ["paymentMode"], message: "Pick the payment mode" });
    }
  });
export type EntryInput = z.input<typeof entrySchema>;
export type EntryValues = z.output<typeof entrySchema>;

const paise = (n: number) => Math.round(n * 100);

// One posted entry, or a pre-summed group of them (same shape), as far as balances care.
export type Flow = { type: string; accountId: string | null; toAccountId: string | null; amount: number };
export type AccountMove = { income: number; expense: number; transferIn: number; transferOut: number };

export function accountMoves(rows: Flow[]): Map<string, AccountMove> {
  const p = new Map<string, AccountMove>();
  const at = (id: string) => p.get(id) ?? (p.set(id, { income: 0, expense: 0, transferIn: 0, transferOut: 0 }), p.get(id)!);
  for (const r of rows) {
    const a = paise(r.amount);
    if (r.type === "transfer") {
      if (r.accountId) at(r.accountId).transferOut += a;
      if (r.toAccountId) at(r.toAccountId).transferIn += a;
    } else if (r.accountId && (r.type === "income" || r.type === "expense")) at(r.accountId)[r.type] += a;
  }
  for (const m of p.values()) for (const k of ["income", "expense", "transferIn", "transferOut"] as const) m[k] /= 100;
  return p;
}

export const closingBalance = (opening: number, m?: AccountMove) =>
  m ? (paise(opening) + paise(m.income) - paise(m.expense) + paise(m.transferIn) - paise(m.transferOut)) / 100 : opening;

// Income, expense, net movement (income - expense) and how many entries. Transfers count as entries only.
export function totals(rows: { type: string; amount: number }[]) {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.type === "income") income += paise(r.amount);
    else if (r.type === "expense") expense += paise(r.amount);
  }
  return { income: income / 100, expense: expense / 100, net: (income - expense) / 100, count: rows.length };
}

// Income / expense / net per group (head, party, payment mode, day...), in first-seen order. Transfers are left out.
export function groupTotals<T extends { type: string; amount: number }>(rows: T[], key: (r: T) => string) {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    if (r.type === "transfer") continue;
    const k = key(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups].map(([k, list]) => ({ key: k, ...totals(list) }));
}
