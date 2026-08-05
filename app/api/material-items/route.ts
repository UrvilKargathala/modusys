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
  const items = await prisma.materialItem.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(items.map((i) => ({
    id: i.id, category: i.category, name: i.name, description: i.description,
    deleted: i.deleted, createdAt: i.createdAt.toISOString(),
  })));
}

// requireUser (not requireRole) — Material Library has inline "+ Add new"
// escape hatches reachable from quote-building by any signed-in user, not
// just admins (MaterialReferenceSelect's whole point is not gating quote
// creation on someone else having set up the library first).
// Bulk id-preserving replace (last-write-wins). Body: MaterialItem[].
export async function PUT(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const oldItems = await prisma.materialItem.findMany();
  const oldMap = new Map(oldItems.map((i) => [i.id, i]));

  const rows = (await req.json()) as Array<Record<string, unknown>>;
  const mapped = rows.map((r) => ({
    id: String(r.id), category: String(r.category), name: String(r.name),
    description: String(r.description ?? ""), deleted: Boolean(r.deleted),
    createdAt: toDate(r.createdAt),
  }));
  await replaceCollection(prisma.materialItem, mapped);

  const newMap = new Map(mapped.map((r) => [r.id, r]));
  for (const r of mapped) {
    const old = oldMap.get(r.id);
    if (!old) {
      void logAudit({ action: "MATERIAL_LIBRARY_ENTRY_CREATED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "MATERIAL_LIBRARY_ENTRY", id: r.id, label: `${r.category}: ${r.name}` }, req });
    } else if (old.name !== r.name || old.description !== r.description || old.deleted !== r.deleted) {
      void logAudit({ action: "MATERIAL_LIBRARY_ENTRY_UPDATED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "MATERIAL_LIBRARY_ENTRY", id: r.id, label: `${r.category}: ${r.name}` }, details: { name: { from: old.name, to: r.name } }, req });
    }
  }
  for (const old of oldItems) {
    if (!newMap.has(old.id)) {
      void logAudit({ action: "MATERIAL_LIBRARY_ENTRY_DELETED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "MATERIAL_LIBRARY_ENTRY", id: old.id, label: `${old.category}: ${old.name}` }, req });
    }
  }

  return NextResponse.json({ ok: true });
}
