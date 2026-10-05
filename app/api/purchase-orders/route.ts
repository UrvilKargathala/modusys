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

export async function POST(req: Request) {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;
  const b = await req.json();
  const poNumber = String(b.poNumber ?? "").trim();
  if (!poNumber) return NextResponse.json({ error: "PO number is required" }, { status: 400 });
  const vendor = await prisma.vendor.findFirst({ where: { id: String(b.vendorId ?? ""), deletedAt: null } });
  if (!vendor) return NextResponse.json({ error: "Choose a vendor" }, { status: 400 });
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      poDate: b.poDate ?? "",
      requiredDate: b.requiredDate ?? "",
      vendorId: vendor.id,
      quoteId: b.quoteId ?? null,
      customerId: b.customerId ?? null,
      material: cleanMaterial(b.material),
      discountPct: Number(b.discountPct) || 0,
      gstMode: b.gstMode === "inter" ? "inter" : "intra",
      roundOff: Number(b.roundOff) || 0,
      remarks: b.remarks ?? "",
      createdById: auth.user.id,
      lines: { create: cleanLines(b.lines) },
    },
    include: { lines: true },
  });
  return NextResponse.json(serializePurchaseOrder(po, vendor.name), { status: 201 });
}
