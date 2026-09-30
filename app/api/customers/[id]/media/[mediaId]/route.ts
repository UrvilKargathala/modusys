import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";
import { deleteKey } from "@/lib/server/s3";

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

  // The DB row is the source of truth for the gallery; storage delete is best-effort after it,
  // so a missing object can't block removing the item. Gallery files are single-owner (never
  // shared by forwarding), so this is a direct delete — no reference count needed.
  await prisma.mediaAttachment.delete({ where: { id: mediaId } });
  try {
    await deleteKey(media.pathname);
  } catch (e) {
    console.warn("[storage] gallery deleteKey failed", (e as { name?: string })?.name);
  }
  return NextResponse.json({ ok: true });
}
