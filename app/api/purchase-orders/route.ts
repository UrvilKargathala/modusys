import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializePurchaseOrder } from "@/lib/server/serialize";
import { requireRole } from "@/lib/server/require-user";
import { cleanLines, cleanMaterial } from "@/lib/server/purchase-order-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;
  const pos = await prisma.purchaseOrder.findMany({
    where: { deletedAt: null },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
  const vendors = await prisma.vendor.findMany({ where: { id: { in: [...new Set(pos.map((p) => p.vendorId))] } } });
  const names = new Map(vendors.map((v) => [v.id, v.name]));
  return NextResponse.json(pos.map((p) => serializePurchaseOrder(p, names.get(p.vendorId) ?? "")));
}

// A PO can start with no vendor and no PO number (created automatically when a quote goes In Production, or by hand);
// both are filled in later and are required before it can be marked Completed.
export async function POST(req: Request) {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;
  const b = await req.json();
  const poNumber = String(b.poNumber ?? "").trim();
  const vendorId = String(b.vendorId ?? "").trim();
  const vendor = vendorId ? await prisma.vendor.findFirst({ where: { id: vendorId, deletedAt: null } }) : null;
  if (vendorId && !vendor) return NextResponse.json({ error: "That vendor no longer exists" }, { status: 400 });

  // Auto-create from a quote: never make a second one for the same quote.
  const quoteId = b.quoteId ?? null;
  if (b.onlyIfNone && quoteId) {
    const existing = await prisma.purchaseOrder.findFirst({ where: { quoteId, deletedAt: null }, include: { lines: true } });
    if (existing) {
      const v = await prisma.vendor.findUnique({ where: { id: existing.vendorId } });
      return NextResponse.json(serializePurchaseOrder(existing, v?.name ?? ""), { status: 200 });
    }
  }

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      poDate: b.poDate ?? "",
      requiredDate: b.requiredDate ?? "",
      vendorId,
      quoteId,
      customerId: b.customerId ?? null,
      material: cleanMaterial(b.material),
      discountPct: Number(b.discountPct) || 0,
      gstMode: b.gstMode === "inter" ? "inter" : "intra",
      status: "pending",
      roundOff: Number(b.roundOff) || 0,
      remarks: b.remarks ?? "",
      createdById: auth.user.id,
      lines: { create: cleanLines(b.lines) },
    },
    include: { lines: true },
  });
  return NextResponse.json(serializePurchaseOrder(po, vendor?.name ?? ""), { status: 201 });
}
