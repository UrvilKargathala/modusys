import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; mediaId: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId, mediaId } = await params;

  const media = await prisma.mediaAttachment.findUnique({ where: { id: mediaId } });
  if (!media || media.customerId !== customerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort blob delete — the DB row is the source of truth for the
  // gallery, so a stale/already-gone blob shouldn't block removing it.
  try {
    await del(media.pathname);
  } catch {
    // ignore
  }

  await prisma.mediaAttachment.delete({ where: { id: mediaId } });
  return NextResponse.json({ ok: true });
}
