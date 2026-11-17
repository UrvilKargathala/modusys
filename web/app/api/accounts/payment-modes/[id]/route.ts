import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { requireRole } from "@backend/server/require-user";
import { logAudit } from "@backend/server/audit";
import { ACCOUNTS_ROLES, isDuplicate } from "@backend/server/accounts-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Rename, deactivate or reactivate a payment mode. No delete. Renaming leaves old entries with the name they were saved with.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(ACCOUNTS_ROLES);
  if (auth.response) return auth.response;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: { name?: string; isActive?: boolean } = {};
  if (b.name !== undefined) {
    data.name = String(b.name).trim().slice(0, 80);
    if (!data.name) return NextResponse.json({ error: "Enter a name" }, { status: 400 });
  }
  if (typeof b.isActive === "boolean") data.isActive = b.isActive;
  try {
    const mode = await prisma.accountPaymentMode.update({ where: { id }, data });
    await logAudit({ action: "ACCOUNT_PAYMENT_MODE_UPDATED", actor: auth.user, target: { type: "ACCOUNT_PAYMENT_MODE", id, label: mode.name }, details: data, req });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isDuplicate(e)) return NextResponse.json({ error: `${data.name} already exists` }, { status: 400 });
    throw e;
  }
}
