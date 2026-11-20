import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { requireUser } from "@backend/server/require-user";
import { presignGet } from "@backend/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/mobile/voice/:messageId → { url } — a 2-minute link to play a chat voice note on the phone. The phone's
// audio player can't send the Bearer header (iOS drops it), so it plays this short-lived storage link instead.
// Same access as /api/files/msg_<id>: any signed-in user.
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const m = await prisma.message.findUnique({ where: { id }, select: { audioKey: true } });
  if (!m?.audioKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ url: await presignGet(m.audioKey) });
}
