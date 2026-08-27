import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { replaceCollection, toDate } from "@/lib/server/bulk";
import { requireUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import type { PanelFormula } from "@/lib/mock/panel-calc-spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePanels(v: unknown): PanelFormula[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      id: String(p.id ?? ""),
      label: String(p.label ?? ""),
      widthFormula: String(p.widthFormula ?? ""),
      heightFormula: String(p.heightFormula ?? ""),
      thickness: Number(p.thickness ?? 0),
    }));
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const rows = await prisma.panelCalcSpec.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rows.map((r) => ({
    id: r.id, brand: r.brand, product: r.product, width: r.width, height: r.height,
    description: r.description, panels: normalizePanels(r.panels),
    createdAt: r.createdAt.toISOString(),
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
    panels: normalizePanels(r.panels),
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
    } else if (JSON.stringify(old.panels) !== JSON.stringify(r.panels)) {
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
