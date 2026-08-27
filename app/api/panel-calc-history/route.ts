import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { replaceCollection, toDate } from "@/lib/server/bulk";
import { requireUser } from "@/lib/server/require-user";
import type { PanelCalcHistoryPanel } from "@/lib/mock/panel-calc-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePanels(v: unknown): PanelCalcHistoryPanel[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      id: String(p.id ?? ""),
      label: String(p.label ?? ""),
      width: Number(p.width ?? 0),
      height: Number(p.height ?? 0),
      thickness: Number(p.thickness ?? 0),
    }));
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const rows = await prisma.panelCalcHistory.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rows.map((r) => ({
    id: r.id, brand: r.brand, product: r.product, width: r.width, length: r.length, height: r.height,
    panels: normalizePanels(r.panels), createdAt: r.createdAt.toISOString(),
  })));
}

// A log, not a business record — no audit trail, just requireUser like the
// spec store. Bulk id-preserving replace (last-write-wins). Body: entry[].
export async function PUT(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const rows = (await req.json()) as Array<Record<string, unknown>>;
  const mapped = rows.map((r) => ({
    id: String(r.id),
    brand: String(r.brand),
    product: String(r.product),
    width: Number(r.width),
    length: Number(r.length),
    height: Number(r.height),
    panels: normalizePanels(r.panels),
    createdAt: toDate(r.createdAt),
  }));
  await replaceCollection(prisma.panelCalcHistory, mapped);

  return NextResponse.json({ ok: true });
}
