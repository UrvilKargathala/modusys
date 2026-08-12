import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeMessage } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId } = await params;
  const messages = await prisma.message.findMany({
    where: { customerId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages.map(serializeMessage));
}

// Handles every message kind — kind defaults to "chat" for the normal text
// composer, "system" for stage-change events, and "voice" | "image" | "pdf"
// once the attachment has already been uploaded via ./upload.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId } = await params;
  const b = await req.json();
  const kind = ["chat", "system", "voice", "image", "pdf"].includes(b.kind) ? b.kind : "chat";

  const message = await prisma.message.create({
    data: {
      customerId,
      kind,
      senderId: kind === "system" ? null : auth.user.id,
      text: b.text ?? undefined,
      mentionedUserIds: Array.isArray(b.mentionedUserIds) ? b.mentionedUserIds : [],
      audioUrl: b.audioUrl ?? undefined,
      durationSec: b.durationSec ?? undefined,
      imageUrl: b.imageUrl ?? undefined,
      imageName: b.imageName ?? undefined,
      pdfUrl: b.pdfUrl ?? undefined,
      pdfName: b.pdfName ?? undefined,
      pdfSize: b.pdfSize ?? undefined,
    },
  });
  return NextResponse.json(serializeMessage(message), { status: 201 });
}
