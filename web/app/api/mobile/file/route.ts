import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { requireUser } from "@backend/server/require-user";
import { presignGet } from "@backend/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mobile/file?message=<id> (a chat PDF) or ?media=<id> (a Photos video / document) → { url }: a 2-minute storage
// link the phone hands to its own viewer (which can't send the Bearer header). Same access as the website's file links:
// any signed-in user.
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const q = new URL(req.url).searchParams;
  const messageId = q.get("message");
  const mediaId = q.get("media");
  if (messageId) {
    const m = await prisma.message.findUnique({ where: { id: messageId }, select: { pdfKey: true } });
    if (!m?.pdfKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ url: await presignGet(m.pdfKey, "application/pdf") });
  }
  if (mediaId) {
    const a = await prisma.mediaAttachment.findUnique({ where: { id: mediaId }, select: { pathname: true } });
    if (!a?.pathname) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ url: await presignGet(a.pathname) });
  }
  return NextResponse.json({ error: "message or media is required" }, { status: 400 });
}
