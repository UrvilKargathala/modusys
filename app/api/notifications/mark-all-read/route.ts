import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  await prisma.notification.updateMany({
    where: { userId: auth.user.id, read: false },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}
