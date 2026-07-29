import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only used to flip read=true on a notification the caller owns. Server-side
// scope check prevents marking someone else's notification read via a
// guessed id.
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing || existing.userId !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.notification.update({ where: { id }, data: { read: true } });
  return NextResponse.json({ ok: true });
}
