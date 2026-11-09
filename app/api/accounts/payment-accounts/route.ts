import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import { ACCOUNTS_ROLES, accountFields, isDuplicate } from "@/lib/server/accounts-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireRole(ACCOUNTS_ROLES);
  if (auth.response) return auth.response;
  const r = accountFields(await req.json().catch(() => ({})), false);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  try {
    const acc = await prisma.paymentAccount.create({ data: r.data as { name: string; kind: string; openingBalance: string } });
    await logAudit({ action: "PAYMENT_ACCOUNT_CREATED", actor: auth.user, target: { type: "PAYMENT_ACCOUNT", id: acc.id, label: acc.name }, details: r.data, req });
    return NextResponse.json({ id: acc.id });
  } catch (e) {
    if (isDuplicate(e)) return NextResponse.json({ error: `${r.data.name} already exists` }, { status: 400 });
    throw e;
  }
}
