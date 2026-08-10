import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { replaceCollection, toDate } from "@/lib/server/bulk";
import { requireUser, requireRole } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const items = await prisma.cabinetType.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(items.map((c) => ({
    id: c.id, name: c.name, shortCode: c.shortCode, active: c.active,
    brandId: c.brandId, description: c.description, components: c.components,
    deleted: c.deleted, createdAt: c.createdAt.toISOString(),
  })));
}

export async function PUT(req: Request) {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;
  const rows = (await req.json()) as Array<Record<string, unknown>>;
  await replaceCollection(prisma.cabinetType, rows.map((r) => ({
    id: String(r.id), name: String(r.name), shortCode: String(r.shortCode),
    active: Boolean(r.active), brandId: String(r.brandId ?? ""), description: String(r.description ?? ""),
    components: (r.components ?? []) as object[], deleted: Boolean(r.deleted), createdAt: toDate(r.createdAt),
  })));
  void logAudit({
    action: "CABINET_TYPE_UPDATED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "CABINET_TYPE", id: "collection", label: `${rows.length} cabinet type(s)` },
    details: { count: rows.length },
    req,
  });
  return NextResponse.json({ ok: true });
}
