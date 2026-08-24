import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — mark all messages in this customer's chat as read by the current user.
// Body: (none needed — marks everything up to now)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId } = await params;

  const messages = await prisma.message.findMany({
    where: { customerId },
    select: { id: true },
  });

  if (messages.length > 0) {
    // Upsert receipts — skip if already exists (@@unique constraint).
    await Promise.all(
      messages.map((m) =>
        prisma.messageReadReceipt.upsert({
          where: { messageId_userId: { messageId: m.id, userId: auth.user.id } },
          create: { messageId: m.id, userId: auth.user.id },
          update: {},
        })
      )
    );
  }

  return NextResponse.json({ ok: true });
}

// GET ?messageId=xxx — fetch read receipts for a single message.
// GET (no messageId) — per-user latest readAt across this whole thread, used
// to render inline ✓✓ ticks without an N+1 fetch per message: a message is
// "seen" once any other user's lastReadAt is >= that message's createdAt.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId } = await params;

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  if (messageId) {
    const receipts = await prisma.messageReadReceipt.findMany({
      where: { messageId },
      orderBy: { readAt: "asc" },
    });
    return NextResponse.json({ receipts });
  }

  const threadMessageIds = await prisma.message.findMany({
    where: { customerId },
    select: { id: true },
  });
  const grouped = await prisma.messageReadReceipt.groupBy({
    by: ["userId"],
    where: { messageId: { in: threadMessageIds.map((m) => m.id) } },
    _max: { readAt: true },
  });
  return NextResponse.json({
    summary: grouped.map((g) => ({ userId: g.userId, lastReadAt: g._max.readAt?.toISOString() ?? null })),
  });
}
