import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { replaceCollection, toDate } from "@/lib/server/bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.hardwarePriceItem.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(items.map((i) => ({
    id: i.id, articleNo: i.articleNo, categoryId: i.categoryId, brandId: i.brandId,
    unitId: i.unitId, levelTypeId: i.levelTypeId, description: i.description, mrp: i.mrp, discountPct: i.discountPct,
    deleted: i.deleted, createdAt: i.createdAt.toISOString(),
  })));
}

export async function PUT(req: Request) {
  const rows = (await req.json()) as Array<Record<string, unknown>>;
  await replaceCollection(prisma.hardwarePriceItem, rows.map((r) => ({
    id: String(r.id), articleNo: String(r.articleNo), categoryId: String(r.categoryId),
    brandId: String(r.brandId), unitId: String(r.unitId), levelTypeId: String(r.levelTypeId ?? ""),
    description: String(r.description ?? ""),
    mrp: Number(r.mrp), discountPct: Number(r.discountPct ?? 0), deleted: Boolean(r.deleted),
    createdAt: toDate(r.createdAt),
  })));
  return NextResponse.json({ ok: true });
}
