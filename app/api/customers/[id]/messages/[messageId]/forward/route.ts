import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeMessage } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

// Copies a message's content into a new message on another customer's
// thread. Forwarding never carries over reply-to/reactions/edits — it's a
// fresh message, just like WhatsApp forward. Body: { targetCustomerIds: string[] }.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { messageId } = await params;
  const b = await req.json();
  const targetCustomerIds: string[] = Array.isArray(b.targetCustomerIds)
    ? b.targetCustomerIds.filter((s: unknown): s is string => typeof s === "string" && s.length > 0)
    : [];
  if (targetCustomerIds.length === 0) {
    return NextResponse.json({ error: "targetCustomerIds is required" }, { status: 400 });
  }

  const source = await prisma.message.findUnique({ where: { id: messageId } });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const created = await Promise.all(
    targetCustomerIds.map((customerId) =>
      prisma.message.create({
        data: {
          customerId,
          kind: source.kind,
          senderId: auth.user.id,
          text: source.text ?? undefined,
          audioUrl: source.audioUrl ?? undefined,
          durationSec: source.durationSec ?? undefined,
          imageUrl: source.imageUrl ?? undefined,
          imageName: source.imageName ?? undefined,
          imageUrls: source.imageUrls,
          imageNames: source.imageNames,
          pdfUrl: source.pdfUrl ?? undefined,
          pdfName: source.pdfName ?? undefined,
          pdfSize: source.pdfSize ?? undefined,
          forwardedFromId: source.id,
        },
        include: { reactions: true },
      })
    )
  );

  return NextResponse.json(created.map((m) => serializeMessage(m, auth.user.id)), { status: 201 });
}
