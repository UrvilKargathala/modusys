import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/require-user";
import { PROCUREMENT_ROLES, serializeProcurement } from "@/lib/server/procurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Save procurement's edits (the whole copy).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(PROCUREMENT_ROLES);
  if (auth.response) return auth.response;
  const { id } = await params;
  const b = await req.json();
  if (typeof b.data !== "object" || b.data === null) return NextResponse.json({ error: "data is required" }, { status: 400 });
  const row = await prisma.procurementQuote.update({ where: { id }, data: { data: b.data } }).catch(() => null);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeProcurement(row));
}
