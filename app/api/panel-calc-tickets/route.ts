import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Panel Calculator tickets: the Other Panel table saved as ticket 1, 2, 3 … (never reused). Only the latest KEEP stay.
const KEEP = 5;

function toJson(r: { id: string; no: number; rows: unknown; createdBy: string; createdAt: Date }) {
  return { id: r.id, no: r.no, rows: Array.isArray(r.rows) ? r.rows : [], createdBy: r.createdBy, createdAt: r.createdAt.toISOString() };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const rows = await prisma.panelCalcTicket.findMany({ orderBy: { no: "desc" }, take: KEEP });
  return NextResponse.json(rows.map(toJson));
}

// Body: { rows: FurnitureLineItem[] }. The server picks the number and drops tickets older than the latest KEEP.
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const body = (await req.json().catch(() => null)) as { rows?: unknown } | null;
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "The table is empty." }, { status: 400 });

  // ponytail: two saves at the same instant can pick the same number; the unique index refuses the second, which can retry.
  const ticket = await prisma.$transaction(async (tx) => {
    const last = await tx.panelCalcTicket.findFirst({ orderBy: { no: "desc" }, select: { no: true } });
    const created = await tx.panelCalcTicket.create({
      data: { id: randomUUID(), no: (last?.no ?? 0) + 1, rows: rows as Prisma.InputJsonValue, createdBy: auth.user.name || auth.user.email },
    });
    const older = await tx.panelCalcTicket.findMany({ orderBy: { no: "desc" }, skip: KEEP, select: { id: true } });
    if (older.length) await tx.panelCalcTicket.deleteMany({ where: { id: { in: older.map((t) => t.id) } } });
    return created;
  });
  return NextResponse.json(toJson(ticket));
}

export async function DELETE(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  await prisma.panelCalcTicket.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
