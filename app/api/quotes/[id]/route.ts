import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// requireUser (not requireRole) — matches today's UI, which has no role gate
// on quote deletion. Worth reconsidering (e.g. restrict to super-admin/admin)
// as a follow-up, but not invented here since it wasn't specified.
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const q = await prisma.quote.findUnique({ where: { id }, select: { quoteNumber: true } });
  await prisma.quote.delete({ where: { id } });
  void logAudit({
    action: "QUOTE_DELETED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "QUOTE", id, label: q?.quoteNumber ?? id },
    req,
  });
  return NextResponse.json({ ok: true });
}
