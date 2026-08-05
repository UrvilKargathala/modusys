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
  const items = await prisma.furniturePriceItem.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(items.map((i) => ({
    id: i.id, thicknessId: i.thicknessId, rawMaterialTypeId: i.rawMaterialTypeId,
    internalColourId: i.internalColourId, externalColourId: i.externalColourId,
    rate: i.rate, deleted: i.deleted, createdAt: i.createdAt.toISOString(),
  })));
}

// requireUser (not requireRole) — reachable from the quote builder's inline
// "Add this combination to Furniture Price List" escape hatch for any
// signed-in user, same reasoning as material-items.
export async function PUT(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const oldItems = await prisma.furniturePriceItem.findMany();
  const oldMap = new Map(oldItems.map((i) => [i.id, i]));

  const rows = (await req.json()) as Array<Record<string, unknown>>;
  const mapped = rows.map((r) => ({
    id: String(r.id), thicknessId: String(r.thicknessId), rawMaterialTypeId: String(r.rawMaterialTypeId),
    internalColourId: String(r.internalColourId), externalColourId: String(r.externalColourId),
    rate: Number(r.rate), deleted: Boolean(r.deleted), createdAt: toDate(r.createdAt),
  }));
  await replaceCollection(prisma.furniturePriceItem, mapped);

  const newMap = new Map(mapped.map((r) => [r.id, r]));
  for (const r of mapped) {
    const old = oldMap.get(r.id);
    const label = `Furniture: ${r.thicknessId} / ${r.rawMaterialTypeId}`;
    if (!old) {
      void logAudit({ action: "PRICE_LIST_ENTRY_CREATED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "PRICE_LIST_ENTRY", id: r.id, label }, details: { rate: r.rate }, req });
    } else if (old.rate !== r.rate || old.deleted !== r.deleted) {
      void logAudit({ action: "PRICE_LIST_ENTRY_UPDATED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "PRICE_LIST_ENTRY", id: r.id, label }, details: { field: "rate", from: old.rate, to: r.rate }, req });
    }
  }
  for (const old of oldItems) {
    if (!newMap.has(old.id)) {
      void logAudit({ action: "PRICE_LIST_ENTRY_DELETED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "PRICE_LIST_ENTRY", id: old.id, label: `Furniture: ${old.thicknessId} / ${old.rawMaterialTypeId}` }, req });
    }
  }

  return NextResponse.json({ ok: true });
}
