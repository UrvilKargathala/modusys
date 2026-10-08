import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/require-user";
import { PROCUREMENT_ROLES, serializeProcurement } from "@/lib/server/procurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(PROCUREMENT_ROLES);
  if (auth.response) return auth.response;
  const rows = await prisma.procurementQuote.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows.map(serializeProcurement));
}

// Make the copy for a quote. A quote only ever has one: if it exists, it is returned unchanged (200).
export async function POST(req: Request) {
  const auth = await requireRole(PROCUREMENT_ROLES);
  if (auth.response) return auth.response;
  const b = await req.json();
  const quoteId = String(b.quoteId ?? "");
  if (!quoteId || typeof b.data !== "object" || b.data === null) return NextResponse.json({ error: "quoteId and data are required" }, { status: 400 });
  const existing = await prisma.procurementQuote.findUnique({ where: { quoteId } });
  if (existing) return NextResponse.json(serializeProcurement(existing));
  const row = await prisma.procurementQuote.create({ data: { id: randomUUID(), quoteId, data: b.data } });
  return NextResponse.json(serializeProcurement(row), { status: 201 });
}
