import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeMessage } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

// Toggle star for the current user — starredBy is per-user, like WhatsApp,
// not a single shared flag.
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { messageId } = await params;
  const existing = await prisma.message.findUnique({ where: { id: messageId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const starred = existing.starredBy.includes(auth.user.id);
  const message = await prisma.message.update({
    where: { id: messageId },
    data: {
      starredBy: starred
        ? existing.starredBy.filter((id) => id !== auth.user.id)
        : [...existing.starredBy, auth.user.id],
    },
    include: { reactions: true },
  });
  return NextResponse.json(serializeMessage(message, auth.user.id));
}
