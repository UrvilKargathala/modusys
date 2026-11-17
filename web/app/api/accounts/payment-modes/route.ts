import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { requireRole } from "@backend/server/require-user";
import { logAudit } from "@backend/server/audit";
import { ACCOUNTS_ROLES, isDuplicate } from "@backend/server/accounts-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Add a payment mode; it goes to the end of the list.
export async function POST(req: Request) {
  const auth = await requireRole(ACCOUNTS_ROLES);
  if (auth.response) return auth.response;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Enter a name" }, { status: 400 });
  try {
    const last = await prisma.accountPaymentMode.aggregate({ _max: { sortOrder: true } });
    const mode = await prisma.accountPaymentMode.create({ data: { name, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await logAudit({ action: "ACCOUNT_PAYMENT_MODE_CREATED", actor: auth.user, target: { type: "ACCOUNT_PAYMENT_MODE", id: mode.id, label: name }, req });
    return NextResponse.json({ id: mode.id });
  } catch (e) {
    if (isDuplicate(e)) return NextResponse.json({ error: `${name} already exists` }, { status: 400 });
    throw e;
  }
}
