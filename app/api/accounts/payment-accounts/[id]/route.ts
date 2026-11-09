import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import { ACCOUNTS_ROLES, accountFields, isDuplicate } from "@/lib/server/accounts-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Edit name / kind / opening balance, or deactivate. No delete: an account with entries must keep existing.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(ACCOUNTS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await params;
  const r = accountFields(await req.json().catch(() => ({})), true);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  try {
    const before = await prisma.paymentAccount.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const acc = await prisma.paymentAccount.update({ where: { id }, data: r.data });
    await logAudit({ action: "PAYMENT_ACCOUNT_UPDATED", actor: auth.user, target: { type: "PAYMENT_ACCOUNT", id, label: acc.name }, details: { ...r.data, ...(r.data.openingBalance !== undefined ? { openingBalanceWas: before.openingBalance.toString() } : {}) }, req });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isDuplicate(e)) return NextResponse.json({ error: `${r.data.name} already exists` }, { status: 400 });
    throw e;
  }
}
