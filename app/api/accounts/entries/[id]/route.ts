import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import { ACCOUNTS_ROLES, entryData } from "@/lib/server/accounts-input";
import { entryNoLabel } from "@/lib/accounts";
import { isoDate } from "@/lib/server/accounts-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Edit a posted entry, or cancel it with { cancel: "reason" }. Entries are never deleted; a cancelled one stays
// on the list (struck through) and leaves every total and balance.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(ACCOUNTS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await params;
  const before = await prisma.accountEntry.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  if (before.status !== "posted") return NextResponse.json({ error: "This entry is cancelled" }, { status: 400 });
  const label = entryNoLabel(before.entryNo);
  const body = await req.json().catch(() => null);

  if (body && typeof body.cancel === "string") {
    const reason = body.cancel.trim().slice(0, 300);
    if (!reason) return NextResponse.json({ error: "Give a reason for cancelling" }, { status: 400 });
    await prisma.accountEntry.update({ where: { id }, data: { status: "cancelled", cancelReason: reason, cancelledAt: new Date(), cancelledById: auth.user.id } });
    await logAudit({ action: "ACCOUNT_ENTRY_CANCELLED", actor: auth.user, target: { type: "ACCOUNT_ENTRY", id, label }, details: { reason, amount: before.amount.toString() }, req });
    return NextResponse.json({ ok: true });
  }

  const r = await entryData(body, before);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  await prisma.accountEntry.update({ where: { id }, data: r.data });
  // What changed, old → new, for the audit log.
  const was: Record<string, unknown> = { ...before, date: isoDate(before.date), amount: before.amount.toString() };
  const now: Record<string, unknown> = { ...r.data, date: isoDate(r.data.date) };
  const changes = Object.fromEntries(Object.keys(now).filter((k) => String(was[k] ?? "") !== String(now[k] ?? "")).map((k) => [k, { from: was[k] ?? null, to: now[k] ?? null }]));
  await logAudit({ action: "ACCOUNT_ENTRY_UPDATED", actor: auth.user, target: { type: "ACCOUNT_ENTRY", id, label }, details: changes, req });
  return NextResponse.json({ ok: true });
}
