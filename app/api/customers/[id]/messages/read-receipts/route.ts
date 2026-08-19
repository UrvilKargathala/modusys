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
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  await params;

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  if (!messageId) return NextResponse.json({ receipts: [] });

  const receipts = await prisma.messageReadReceipt.findMany({
    where: { messageId },
    orderBy: { readAt: "asc" },
  });

  return NextResponse.json({ receipts });
}
