import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { replaceCollection, toDate } from "@/lib/server/bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.furniturePriceItem.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(items.map((i) => ({
    id: i.id, thicknessId: i.thicknessId, rawMaterialTypeId: i.rawMaterialTypeId,
    internalColourId: i.internalColourId, externalColourId: i.externalColourId,
    rate: i.rate, deleted: i.deleted, createdAt: i.createdAt.toISOString(),
  })));
}

export async function PUT(req: Request) {
  const rows = (await req.json()) as Array<Record<string, unknown>>;
  await replaceCollection(prisma.furniturePriceItem, rows.map((r) => ({
    id: String(r.id), thicknessId: String(r.thicknessId), rawMaterialTypeId: String(r.rawMaterialTypeId),
    internalColourId: String(r.internalColourId), externalColourId: String(r.externalColourId),
    rate: Number(r.rate), deleted: Boolean(r.deleted), createdAt: toDate(r.createdAt),
  })));
  return NextResponse.json({ ok: true });
}
