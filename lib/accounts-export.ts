import { PARTY_LABEL, TYPE_LABEL, ddmmyyyy, entryNoLabel } from "@/lib/accounts";
import type { BalanceRow, EntryRow } from "@/lib/server/accounts-data";

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
];
