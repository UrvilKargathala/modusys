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

  // Multi-image sends supply imageUrls[]; for a single image the client can
  // still send scalar imageUrl (legacy path) — normalise here so the row has
  // both populated and downstream renderers can trust either.
  const imageUrls: string[] = Array.isArray(b.imageUrls)
    ? b.imageUrls.filter((s: unknown): s is string => typeof s === "string" && s.length > 0)
    : b.imageUrl
    ? [b.imageUrl]
    : [];
  const imageNames: string[] = Array.isArray(b.imageNames)
    ? b.imageNames.filter((s: unknown): s is string => typeof s === "string")
    : b.imageName
    ? [b.imageName]
    : [];

  const message = await prisma.message.create({
    data: {
      customerId,
      kind,
      senderId: kind === "system" ? null : auth.user.id,
      text: b.text ?? undefined,
      mentionedUserIds: Array.isArray(b.mentionedUserIds) ? b.mentionedUserIds : [],
      audioUrl: b.audioUrl ?? undefined,
      durationSec: b.durationSec ?? undefined,
      imageUrl: imageUrls[0] ?? undefined,
      imageName: imageNames[0] ?? undefined,
      imageUrls,
      imageNames,
      pdfUrl: b.pdfUrl ?? undefined,
      pdfName: b.pdfName ?? undefined,
      pdfSize: b.pdfSize ?? undefined,
      replyToMessageId: typeof b.replyToMessageId === "string" ? b.replyToMessageId : undefined,
    },
  });

  // @-mentions in a real chat message auto-create a follow-up task for each
  // mentioned user, plus a bell notification so they see it immediately.
  // Self-mentions and system messages are skipped.
  if (
    message.kind !== "system" &&
    message.mentionedUserIds.length > 0
  ) {
    const uniqueMentions = Array.from(new Set(message.mentionedUserIds)).filter(
      (id) => id !== auth.user.id
    );
    if (uniqueMentions.length > 0) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { name: true },
      });
      const rawTitle = (message.text ?? "").trim();
      const title = rawTitle
        ? rawTitle.slice(0, 120)
        : message.kind === "image"
        ? "Follow up on shared image"
        : message.kind === "pdf"
        ? "Follow up on shared PDF"
        : message.kind === "voice"
        ? "Follow up on voice note"
        : "Follow up from chat";
      const preview = rawTitle ? rawTitle.slice(0, 60) : title;
      const customerLabel = customer?.name ? ` in ${customer.name}` : "";

      // Sequential inside a Promise.all — each mention gets its own task +
      // notification pair; failures don't roll back the message itself since
      // it's already been sent to the customer.
      await Promise.all(
        uniqueMentions.map(async (mentionedId) => {
          const task = await prisma.task.create({
            data: {
              title,
              description: "",
              dueDate: "",
              priority: "normal",
              status: "pending",
              assigneeId: mentionedId,
              createdById: auth.user.id,
              linkedCustomerId: customerId,
            },
          });
          await prisma.notification.create({
            data: {
              userId: mentionedId,
              type: "mentioned",
              relatedTaskId: task.id,
              message: `${auth.user.name} mentioned you${customerLabel}: "${preview}"`,
              read: false,
            },
          });
        })
      );
    }
  }

  return NextResponse.json(serializeMessage(message), { status: 201 });
}
