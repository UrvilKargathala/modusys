import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(row: {
  id: string; userId: string; type: string; relatedTaskId: string | null;
  message: string; read: boolean; createdAt: Date;
}) {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    // The client shape has always used relatedTaskId as a required string
    // (never nullable) — keep that behaviour with "" as the "no linked task"
    // sentinel so no consumer has to null-check.
    relatedTaskId: row.relatedTaskId ?? "",
    message: row.message,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const rows = await prisma.notification.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(rows.map(serialize));
}
