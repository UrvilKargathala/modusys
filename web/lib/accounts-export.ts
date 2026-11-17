import { PARTY_LABEL, TYPE_LABEL, ddmmyyyy, entryNoLabel } from "@shared/accounts";
import type { BalanceRow, EntryRow } from "@backend/server/accounts-data";
import { particulars, type Ledger } from "@/components/accounts/ledger-table";

// Sheet rows for the Excel buttons: a header row, then one row per item. Amounts stay numbers.
export const entrySheet = (rows: EntryRow[]): (string | number)[][] => [
  ["Entry No.", "Date", "Type", "Account Head", "Party / Person", "Party Type", "Payment Account", "To Account", "Mode", "Amount", "Remarks", "Status", "Created By"],
  ...rows.map((r) => [
    entryNoLabel(r.entryNo), ddmmyyyy(r.date), TYPE_LABEL[r.type], r.headName, r.partyName, PARTY_LABEL[r.partyType] ?? "", r.accountName, r.toAccountName, r.paymentMode, r.amount,
    r.status === "posted" ? r.remarks : `Cancelled: ${r.cancelReason}`, r.status === "posted" ? "Posted" : "Cancelled", r.createdByName,
  ]),
];

export const balanceSheet = (rows: BalanceRow[]): (string | number)[][] => [
  ["Payment Account", "Opening", "Income", "Expense", "Transfers In", "Transfers Out", "Closing"],
  ...rows.map((r) => [r.name, r.opening, r.income, r.expense, r.transferIn, r.transferOut, r.closing]),
  ...(rows.length > 1 ? [["Total", ...(["opening", "income", "expense", "transferIn", "transferOut", "closing"] as const).map((k) => sum(rows.map((r) => r[k])))]] : []),
];

// Adds in paise so the totals stay exact.
const sum = (xs: number[]) => xs.reduce((s, x) => s + Math.round(x * 100), 0) / 100;

// A payment account's ledger as listed on screen: opening row, the shown lines with running balance, closing row.
export const ledgerSheet = (l: Ledger, accountId: string, shown: (r: EntryRow) => boolean): (string | number)[][] => [
  ["Date", "Entry No.", "Mode", "Particulars", "Remarks", "Money In", "Money Out", "Balance"],
  ["", "", "", "Opening balance", "", "", "", l.opening],
  ...l.lines.filter((x) => shown(x.row)).map(({ row: r, moneyIn, moneyOut, balance }) => [
    ddmmyyyy(r.date), entryNoLabel(r.entryNo), r.paymentMode, particulars(r, accountId), r.remarks, moneyIn || "", moneyOut || "", balance,
  ]),
  ["", "", "", "Closing balance", "", l.moneyIn, l.moneyOut, l.closing],
];
