import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// requireUser (not requireRole) — matches today's UI, which has no role gate
// on quote deletion. Worth reconsidering (e.g. restrict to super-admin/admin)
// as a follow-up, but not invented here since it wasn't specified.
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  await prisma.quote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
