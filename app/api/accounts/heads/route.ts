import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import { ACCOUNTS_ROLES, isDuplicate } from "@/lib/server/accounts-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireRole(ACCOUNTS_ROLES);
  if (auth.response) return auth.response;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const type = b.type === "income" || b.type === "expense" ? b.type : "";
  if (!name || !type) return NextResponse.json({ error: "Enter a name and pick Income or Expense" }, { status: 400 });
  try {
    const head = await prisma.accountHead.create({ data: { name, type } });
    await logAudit({ action: "ACCOUNT_HEAD_CREATED", actor: auth.user, target: { type: "ACCOUNT_HEAD", id: head.id, label: name }, details: { type }, req });
    return NextResponse.json({ id: head.id });
  } catch (e) {
    if (isDuplicate(e)) return NextResponse.json({ error: `${name} already exists` }, { status: 400 });
    throw e;
  }
}
