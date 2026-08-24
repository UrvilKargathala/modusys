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
    include: { reactions: true },
  });
  return NextResponse.json(serializeMessage(message, auth.user.id));
}

// DELETE ?scope=me|everyone (default "everyone" for the sender/super-admin,
// forced to "me" for anyone else). "me" hides the row for just this user via
// deletedForUserIds instead of removing it, so it still shows for others.
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { messageId } = await params;
  const existing = await prisma.message.findUnique({ where: { id: messageId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnerOrAdmin = existing.senderId === auth.user.id || auth.user.role === "super-admin";
  const url = new URL(req.url);
  const requestedScope = url.searchParams.get("scope") === "me" ? "me" : "everyone";
  const scope = isOwnerOrAdmin ? requestedScope : "me";

  if (scope === "everyone") {
    await prisma.message.delete({ where: { id: messageId } });
  } else {
    if (!existing.deletedForUserIds.includes(auth.user.id)) {
      await prisma.message.update({
        where: { id: messageId },
        data: { deletedForUserIds: { push: auth.user.id } },
      });
    }
  }
  return NextResponse.json({ ok: true, scope });
}
