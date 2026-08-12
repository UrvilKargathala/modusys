import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeMessage } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

// Edit — only the sender may edit their own text message.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { messageId } = await params;
  const existing = await prisma.message.findUnique({ where: { id: messageId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.senderId !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const b = await req.json();
  const text = String(b.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const message = await prisma.message.update({
    where: { id: messageId },
    data: { text, editedAt: new Date() },
  });
  return NextResponse.json(serializeMessage(message));
}

// Delete — sender or super-admin.
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { messageId } = await params;
  const existing = await prisma.message.findUnique({ where: { id: messageId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.senderId !== auth.user.id && auth.user.role !== "super-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.message.delete({ where: { id: messageId } });
  return NextResponse.json({ ok: true });
}
