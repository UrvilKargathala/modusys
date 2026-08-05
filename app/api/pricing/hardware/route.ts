import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { replaceCollection, toDate } from "@/lib/server/bulk";
import { requireUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const items = await prisma.hardwarePriceItem.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(items.map((i) => ({
    id: i.id, articleNo: i.articleNo, categoryId: i.categoryId, brandId: i.brandId,
    unitId: i.unitId, levelTypeId: i.levelTypeId, description: i.description, mrp: i.mrp, discountPct: i.discountPct,
    deleted: i.deleted, createdAt: i.createdAt.toISOString(),
  })));
}

// requireUser (not requireRole) — same reasoning as pricing/furniture.
export async function PUT(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const oldItems = await prisma.hardwarePriceItem.findMany();
  const oldMap = new Map(oldItems.map((i) => [i.id, i]));

  const rows = (await req.json()) as Array<Record<string, unknown>>;
  const mapped = rows.map((r) => ({
    id: String(r.id), articleNo: String(r.articleNo), categoryId: String(r.categoryId),
    brandId: String(r.brandId), unitId: String(r.unitId), levelTypeId: String(r.levelTypeId ?? ""),
    description: String(r.description ?? ""),
    mrp: Number(r.mrp), discountPct: Number(r.discountPct ?? 0), deleted: Boolean(r.deleted),
    createdAt: toDate(r.createdAt),
  }));
  await replaceCollection(prisma.hardwarePriceItem, mapped);

  const newMap = new Map(mapped.map((r) => [r.id, r]));
  for (const r of mapped) {
    const old = oldMap.get(r.id);
    const label = `Hardware: ${r.articleNo || r.description}`;
    if (!old) {
      void logAudit({ action: "PRICE_LIST_ENTRY_CREATED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "PRICE_LIST_ENTRY", id: r.id, label }, details: { mrp: r.mrp, discountPct: r.discountPct }, req });
    } else if (old.mrp !== r.mrp || old.discountPct !== r.discountPct || old.deleted !== r.deleted) {
      void logAudit({ action: "PRICE_LIST_ENTRY_UPDATED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "PRICE_LIST_ENTRY", id: r.id, label }, details: { field: "mrp", from: old.mrp, to: r.mrp, discountFrom: old.discountPct, discountTo: r.discountPct }, req });
    }
  }
  for (const old of oldItems) {
    if (!newMap.has(old.id)) {
      void logAudit({ action: "PRICE_LIST_ENTRY_DELETED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "PRICE_LIST_ENTRY", id: old.id, label: `Hardware: ${old.articleNo || old.description}` }, req });
    }
  }

  return NextResponse.json({ ok: true });
}
