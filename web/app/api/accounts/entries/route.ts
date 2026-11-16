import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { requireRole } from "@backend/server/require-user";
import { logAudit } from "@backend/server/audit";
import { ACCOUNTS_ROLES, entryData } from "@backend/server/accounts-input";
import { entryNoLabel } from "@shared/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Add one income, expense or transfer. The entry number comes from the database sequence, so it is never reused.
export async function POST(req: Request) {
  const auth = await requireRole(ACCOUNTS_ROLES);
  if (auth.response) return auth.response;
  const r = await entryData(await req.json().catch(() => null));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const entry = await prisma.accountEntry.create({ data: { ...r.data, createdById: auth.user.id, createdByName: auth.user.name } });
  const label = entryNoLabel(entry.entryNo);
  await logAudit({ action: "ACCOUNT_ENTRY_CREATED", actor: auth.user, target: { type: "ACCOUNT_ENTRY", id: entry.id, label }, details: { type: entry.type, amount: r.data.amount }, req });
  return NextResponse.json({ id: entry.id, entryNo: label });
}
