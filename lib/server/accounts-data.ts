import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireRoleOrRedirect } from "@/lib/server/require-role";
import { accountMoves, closingBalance, type Flow } from "@/lib/accounts";

// Reads for the Accounts pages. Dates are "YYYY-MM-DD" strings in and out (stored as DATE).
export const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Every loader below checks the caller first. A layout's redirect does not stop its page from rendering (they run in
// parallel), so the guard must live with the data, not only in app/(app)/accounts/layout.tsx.
const guard = cache(() => requireRoleOrRedirect(["super-admin"], "/crm"));

export type Masters = Awaited<ReturnType<typeof getMasters>>;
export type HeadRow = Masters["heads"][number];
export type AccountRow = Masters["accounts"][number];
export type PartyOption = Masters["parties"][number];

// cache(): the layout and the page both ask for it on the same request; it runs once.
export const getMasters = cache(async () => {
  await guard();
  const [heads, accounts, customers, vendors, employees] = await Promise.all([
    prisma.accountHead.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }], include: { _count: { select: { entries: true } } } }),
    prisma.paymentAccount.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { entries: true, transfersIn: true } } } }),
    prisma.customer.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { deletedAt: null }, select: { id: true, name: true, kind: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    heads: heads.map((h) => ({ id: h.id, name: h.name, type: h.type, isActive: h.isActive, used: h._count.entries })),
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, openingBalance: Number(a.openingBalance), isActive: a.isActive, used: a._count.entries + a._count.transfersIn })),
    parties: [
      ...customers.map((c) => ({ type: "customer", id: c.id, name: c.name })),
      ...vendors.map((v) => ({ type: v.kind === "dealer" ? "dealer" : "vendor", id: v.id, name: v.name })),
      ...employees.map((e) => ({ type: "employee", id: e.id, name: e.name })),
    ],
  };
});

const entryInclude = { head: { select: { name: true } }, account: { select: { name: true } }, toAccount: { select: { name: true } } } as const;
type EntryWithNames = Prisma.AccountEntryGetPayload<{ include: typeof entryInclude }>;

export type EntryRow = ReturnType<typeof toRow>;
const toRow = (e: EntryWithNames) => ({
  id: e.id,
  entryNo: e.entryNo,
  date: isoDate(e.date),
  type: e.type,
  headId: e.headId ?? "",
  headName: e.head?.name ?? "",
  accountId: e.accountId,
  accountName: e.account.name,
  toAccountId: e.toAccountId ?? "",
  toAccountName: e.toAccount?.name ?? "",
  amount: Number(e.amount),
  paymentMode: e.paymentMode,
  partyType: e.partyType,
  partyId: e.partyId ?? "",
  partyName: e.partyName,
  remarks: e.remarks,
  attachmentName: e.attachmentKey ? (e.attachmentName || "Attachment") : "",
  status: e.status,
  cancelReason: e.cancelReason,
  createdByName: e.createdByName,
});

// ponytail: no paging; every page asks for a date range, which keeps this to a few hundred rows a month.
export async function loadEntries(where: Prisma.AccountEntryWhereInput) {
  await guard();
  const rows = await prisma.accountEntry.findMany({ where, include: entryInclude, orderBy: [{ date: "desc" }, { entryNo: "desc" }] });
  return rows.map(toRow);
}

// Posted money movement per account inside `date`, summed in the database (pre-summed rows have the Flow shape).
async function flows(date: Prisma.DateTimeFilter): Promise<Flow[]> {
  const where = { status: "posted", date };
  const [own, ins] = await Promise.all([
    prisma.accountEntry.groupBy({ by: ["accountId", "type"], where, _sum: { amount: true } }),
    prisma.accountEntry.groupBy({ by: ["toAccountId"], where: { ...where, type: "transfer" }, _sum: { amount: true } }),
  ]);
  return [
    ...own.map((g) => ({ type: g.type, accountId: g.accountId, toAccountId: null, amount: Number(g._sum.amount ?? 0) })),
    ...ins.map((g) => ({ type: "transfer", accountId: null, toAccountId: g.toAccountId, amount: Number(g._sum.amount ?? 0) })),
  ];
}

export type BalanceRow = Awaited<ReturnType<typeof loadBalances>>[number];

// Each account's balance at the start of `from`, its movement from `from` to `to`, and its closing balance on `to`.
export async function loadBalances(accounts: AccountRow[], from: string, to: string) {
  await guard();
  const [before, during] = await Promise.all([flows({ lt: toDate(from) }), flows({ gte: toDate(from), lte: toDate(to) })]);
  const pre = accountMoves(before);
  const mid = accountMoves(during);
  return accounts
    .map((a) => {
      const opening = closingBalance(a.openingBalance, pre.get(a.id));
      const m = mid.get(a.id) ?? { income: 0, expense: 0, transferIn: 0, transferOut: 0 };
      return { id: a.id, name: a.name, kind: a.kind, isActive: a.isActive, opening, ...m, closing: closingBalance(opening, m) };
    })
    // Inactive accounts only while they still hold money or moved in the period.
    .filter((r) => r.isActive || r.opening || r.closing || r.income || r.expense || r.transferIn || r.transferOut);
}
