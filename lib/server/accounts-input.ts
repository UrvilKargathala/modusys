import "server-only";
import { prisma } from "@/lib/server/prisma";
import { ACCOUNT_KIND_LABEL, entrySchema, PAYMENT_MODES } from "@/lib/accounts";
import { istDateString } from "@/lib/attendance-config";
import { toDate } from "@/lib/server/accounts-data";

export const ACCOUNTS_ROLES = ["super-admin"];

// Validates an entry from the form against the masters and returns the Prisma data, or the first error to show.
// On an edit, `current` lets an entry keep a head or account that has since been deactivated.
export async function entryData(body: unknown, current?: { headId: string | null; accountId: string; toAccountId: string | null }) {
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the entry" };
  const v = parsed.data;
  if (v.date > istDateString()) return { error: "The date cannot be in the future" };
  const transfer = v.type === "transfer";
  if (v.paymentMode && !(PAYMENT_MODES as readonly string[]).includes(v.paymentMode)) return { error: "Unknown payment mode" };

  if (!transfer) {
    const head = await prisma.accountHead.findUnique({ where: { id: v.headId } });
    if (!head || head.type !== v.type) return { error: "Pick an account head of the same type" };
    if (!head.isActive && head.id !== current?.headId) return { error: `${head.name} is inactive` };
  }
  for (const id of transfer ? [v.accountId, v.toAccountId] : [v.accountId]) {
    const acc = await prisma.paymentAccount.findUnique({ where: { id } });
    if (!acc) return { error: "Payment account not found" };
    if (!acc.isActive && id !== current?.accountId && id !== current?.toAccountId) return { error: `${acc.name} is inactive` };
  }

  // A picked party takes its name from its own record; otherwise the typed name is kept as is.
  let partyName = v.partyName;
  if (v.partyType) {
    const found =
      v.partyType === "customer" ? await prisma.customer.findUnique({ where: { id: v.partyId }, select: { name: true } })
      : v.partyType === "employee" ? await prisma.employee.findUnique({ where: { id: v.partyId }, select: { name: true } })
      : await prisma.vendor.findUnique({ where: { id: v.partyId }, select: { name: true } });
    if (!found) return { error: "That party no longer exists" };
    partyName = found.name;
  }
  if (v.attachmentKey && !v.attachmentKey.startsWith("accounts/")) return { error: "Bad attachment" };

  return {
    data: {
      date: toDate(v.date),
      type: v.type,
      headId: transfer ? null : v.headId,
      accountId: v.accountId,
      toAccountId: transfer ? v.toAccountId : null,
      amount: String(v.amount),
      paymentMode: v.paymentMode,
      partyType: v.partyType,
      partyId: v.partyType ? v.partyId : null,
      partyName,
      remarks: v.remarks,
      // Left out when no new file was chosen, so an edit keeps the old one.
      ...(v.attachmentKey ? { attachmentKey: v.attachmentKey, attachmentName: v.attachmentName || "Attachment" } : {}),
    },
  };
}

// Unique-name clash from Prisma, as a message for the form.
export const isDuplicate = (e: unknown) => (e as { code?: string })?.code === "P2002";

// Payment account fields from the form (all of them on create, only those sent on edit), or an error.
export function accountFields(b: Record<string, unknown>, partial: boolean) {
  const data: { name?: string; kind?: string; openingBalance?: string; isActive?: boolean } = {};
  if (!partial || b.name !== undefined) {
    data.name = String(b.name ?? "").trim().slice(0, 80);
    if (!data.name) return { error: "Enter the account name" };
  }
  if (!partial || b.kind !== undefined) {
    data.kind = String(b.kind ?? "");
    if (!ACCOUNT_KIND_LABEL[data.kind]) return { error: "Pick the account kind" };
  }
  if (!partial || b.openingBalance !== undefined) {
    const t = String(b.openingBalance ?? "").trim() || "0";
    // An overdrawn bank account can open below zero.
    if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(t)) return { error: "Enter the opening balance in rupees (up to 2 decimals)" };
    data.openingBalance = t;
  }
  if (typeof b.isActive === "boolean") data.isActive = b.isActive;
  return { data };
}
