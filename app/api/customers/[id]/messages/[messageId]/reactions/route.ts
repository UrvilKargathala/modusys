import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeMessage } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

// Toggle: reacting with an emoji you've already used on this message removes
// it, same as tapping a reaction again in WhatsApp. Body: { emoji }.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { messageId } = await params;
  const b = await req.json();
  const emoji = typeof b.emoji === "string" ? b.emoji.trim() : "";
  if (!emoji) return NextResponse.json({ error: "emoji is required" }, { status: 400 });

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: auth.user.id, emoji } },
  });

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({ data: { messageId, userId: auth.user.id, emoji } });
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { reactions: true },
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeMessage(message, auth.user.id));
}
