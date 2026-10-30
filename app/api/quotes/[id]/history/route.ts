import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// A quote's History (All Quotes > History): its created / edited / status changed audit entries, newest first, with the
// Remarks and list of changes saved with each edit.
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const rows = await prisma.auditLog.findMany({
    where: { targetType: "QUOTE", targetId: id, action: { in: ["QUOTE_CREATED", "QUOTE_UPDATED", "QUOTE_STATUS_CHANGED"] } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      action: r.action,
      by: r.actorName || r.actorEmail,
      at: r.createdAt.toISOString(),
      details: r.details ?? null,
    }))
  );
}
