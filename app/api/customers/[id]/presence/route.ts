import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// A user counts as "online" (viewing this customer's chat right now) if
// their presence row updated within the last ONLINE_WINDOW_MS — there's no
// explicit sign-off, so recency is the only signal, same tradeoff as the
// existing 4s message poll.
const ONLINE_WINDOW_MS = 15_000;

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId } = await params;
  const rows = await prisma.chatPresence.findMany({ where: { customerId } });
  const now = Date.now();
  return NextResponse.json(
    rows
      .filter((r) => r.userId !== auth.user.id)
      .map((r) => ({
        userId: r.userId,
        isTyping: r.isTyping && now - r.updatedAt.getTime() < ONLINE_WINDOW_MS,
        online: now - r.updatedAt.getTime() < ONLINE_WINDOW_MS,
        lastSeenAt: r.updatedAt.toISOString(),
      }))
  );
}

// Upserts the caller's own presence row. Body: { isTyping: boolean }.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId } = await params;
  const b = await req.json().catch(() => ({}));
  const isTyping = b.isTyping === true;

  await prisma.chatPresence.upsert({
    where: { customerId_userId: { customerId, userId: auth.user.id } },
    update: { isTyping },
    create: { customerId, userId: auth.user.id, isTyping },
  });
  return NextResponse.json({ ok: true });
}
