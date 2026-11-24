import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { requireRole } from "@backend/server/require-user";
import { decryptPassword } from "@backend/server/password-vault";
import { logAudit } from "@backend/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Super-admin only: reveal a user's current password. Every view is audited.
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, passwordEncrypted: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const password = user.passwordEncrypted ? decryptPassword(user.passwordEncrypted) : null;

  void logAudit({
    action: "USER_PASSWORD_VIEWED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "USER", id: user.id, label: `${user.name} (${user.email})` },
    req,
  });

  return NextResponse.json({ password }, { headers: { "Cache-Control": "no-store" } });
}
