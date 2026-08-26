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
  const rows = await prisma.panelCalcSpec.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rows.map((r) => ({
    id: r.id, brand: r.brand, product: r.product, width: r.width, height: r.height,
    description: r.description, bottomPanelWidth: r.bottomPanelWidth, bottomPanelHeight: r.bottomPanelHeight,
    backPanelWidth: r.backPanelWidth, backPanelHeight: r.backPanelHeight, createdAt: r.createdAt.toISOString(),
  })));
}

// requireUser (not requireRole) — mirrors Material Library: the calculator's
// inline "+ Add spec" escape hatch is reachable by any signed-in user.
// Bulk id-preserving replace (last-write-wins). Body: PanelCalcSpec[].
export async function PUT(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const oldRows = await prisma.panelCalcSpec.findMany();
  const oldMap = new Map(oldRows.map((r) => [r.id, r]));

  const rows = (await req.json()) as Array<Record<string, unknown>>;
  const mapped = rows.map((r) => ({
    id: String(r.id),
    brand: String(r.brand),
    product: String(r.product),
    width: Number(r.width),
    height: Number(r.height),
    description: String(r.description ?? ""),
    bottomPanelWidth: Number(r.bottomPanelWidth),
    bottomPanelHeight: Number(r.bottomPanelHeight),
    backPanelWidth: Number(r.backPanelWidth),
    backPanelHeight: Number(r.backPanelHeight),
    createdAt: toDate(r.createdAt),
  }));
  await replaceCollection(prisma.panelCalcSpec, mapped);

  const newMap = new Map(mapped.map((r) => [r.id, r]));
  const label = (r: { brand: string; product: string; width: number; height: number }) =>
    `${r.brand} ${r.product} — ${r.width}×${r.height}`;
  for (const r of mapped) {
    const old = oldMap.get(r.id);
    if (!old) {
      void logAudit({ action: "PANEL_CALC_SPEC_CREATED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "PANEL_CALC_SPEC", id: r.id, label: label(r) }, req });
    } else if (
      old.bottomPanelWidth !== r.bottomPanelWidth ||
      old.bottomPanelHeight !== r.bottomPanelHeight ||
      old.backPanelWidth !== r.backPanelWidth ||
      old.backPanelHeight !== r.backPanelHeight
    ) {
      void logAudit({ action: "PANEL_CALC_SPEC_UPDATED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "PANEL_CALC_SPEC", id: r.id, label: label(r) }, req });
    }
  }
  for (const old of oldRows) {
    if (!newMap.has(old.id)) {
      void logAudit({ action: "PANEL_CALC_SPEC_DELETED", actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name }, target: { type: "PANEL_CALC_SPEC", id: old.id, label: label(old) }, req });
    }
  }

  return NextResponse.json({ ok: true });
}
