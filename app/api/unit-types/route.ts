import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { replaceCollection, toDate } from "@/lib/server/bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.unitType.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(items.map((u) => ({
    id: u.id, name: u.name, shortCode: u.shortCode, active: u.active,
    brandId: u.brandId, description: u.description,
    cabinetTypeLinks: u.cabinetTypeLinks, components: u.components,
    externalFinishes: u.externalFinishes, otherPanels: u.otherPanels, hardware: u.hardware,
    deleted: u.deleted, createdAt: u.createdAt.toISOString(),
  })));
}

export async function PUT(req: Request) {
  const rows = (await req.json()) as Array<Record<string, unknown>>;
  await replaceCollection(prisma.unitType, rows.map((r) => ({
    id: String(r.id), name: String(r.name), shortCode: String(r.shortCode), active: Boolean(r.active),
    brandId: String(r.brandId ?? ""), description: String(r.description ?? ""),
    cabinetTypeLinks: (r.cabinetTypeLinks ?? []) as object[], components: (r.components ?? []) as object[],
    externalFinishes: (r.externalFinishes ?? []) as object[], otherPanels: (r.otherPanels ?? []) as object[],
    hardware: (r.hardware ?? []) as object[], deleted: Boolean(r.deleted), createdAt: toDate(r.createdAt),
  })));
  return NextResponse.json({ ok: true });
}
