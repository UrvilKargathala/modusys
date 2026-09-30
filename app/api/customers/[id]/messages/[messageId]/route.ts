import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeMessage } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";
import { deleteKeyIfUnreferenced } from "@/lib/server/s3";

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

  if (typeof b.removeImageIndex === "number") {
    const i = b.removeImageIndex;
    const count = Math.max(existing.imageKeys.length, existing.imageUrls.length);
    // A negative or out-of-range index would make splice() drop the wrong image (or none).
    if (!Number.isInteger(i) || i < 0 || i >= count) {
      return NextResponse.json({ error: "removeImageIndex out of range" }, { status: 400 });
    }
    // Capture the key BEFORE splicing, then keep keys, legacy URLs and names in step.
    const removedKey = existing.imageKeys[i];
    const keys = [...existing.imageKeys];
    const urls = [...existing.imageUrls];
    const names = [...existing.imageNames];
    keys.splice(i, 1);
    urls.splice(i, 1);
    names.splice(i, 1);

    let response: NextResponse;
    if (keys.length === 0 && urls.length === 0) {
      await prisma.message.delete({ where: { id: messageId } });
      response = NextResponse.json({ ok: true, deleted: true });
    } else {
      const message = await prisma.message.update({
        where: { id: messageId },
        data: {
          imageKeys: keys,
          imageUrls: urls,
          imageNames: names,
          imageUrl: urls[0] ?? null,
          imageName: names[0] ?? null,
        },
        include: { reactions: true },
      });
      response = NextResponse.json(serializeMessage(message, auth.user.id));
    }
    // Row first, count second (§8.4): the file only dies when no other message still uses it.
    if (removedKey) await deleteKeyIfUnreferenced(removedKey);
    return response;
  }

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
    // Collect the row's keys before touching anything, delete the row FIRST, then count.
    // Forwarded copies share these objects, so a file is only destroyed at zero references.
    const keys = Array.from(
      new Set([...existing.imageKeys, existing.audioKey, existing.pdfKey].filter((k): k is string => !!k))
    );
    await prisma.message.delete({ where: { id: messageId } });
    await Promise.all(keys.map((k) => deleteKeyIfUnreferenced(k)));
  } else {
    // scope "me" only hides the row for this user — it performs zero storage operations.
    if (!existing.deletedForUserIds.includes(auth.user.id)) {
      await prisma.message.update({
        where: { id: messageId },
        data: { deletedForUserIds: { push: auth.user.id } },
      });
    }
  }
  return NextResponse.json({ ok: true, scope });
}
