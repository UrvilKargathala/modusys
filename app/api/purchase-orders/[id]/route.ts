import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializePurchaseOrder } from "@/lib/server/serialize";
import { requireRole } from "@/lib/server/require-user";
import { cleanLines, cleanMaterial } from "@/lib/server/purchase-order-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const ROLES = ["super-admin", "admin"];

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireRole(ROLES);
  if (auth.response) return auth.response;
  const { id } = await params;
  const po = await prisma.purchaseOrder.findFirst({ where: { id, deletedAt: null }, include: { lines: true } });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const vendor = await prisma.vendor.findUnique({ where: { id: po.vendorId } });
  return NextResponse.json(serializePurchaseOrder(po, vendor?.name ?? ""));
}

// Header fields are patched individually; `lines`, when sent, replaces all
// lines (the editor always sends the full list) inside one transaction.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(ROLES);
  if (auth.response) return auth.response;
  const { id } = await params;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["poDate", "requiredDate", "remarks"] as const) if (b[k] !== undefined) data[k] = String(b[k]);
  if (b.poNumber !== undefined) data.poNumber = String(b.poNumber).trim();
  if (b.customerId !== undefined) data.customerId = b.customerId ? String(b.customerId) : null;
  if (b.vendorId !== undefined) {
    const vid = String(b.vendorId).trim();
    if (vid) {
      const v = await prisma.vendor.findFirst({ where: { id: vid, deletedAt: null } });
      if (!v) return NextResponse.json({ error: "That vendor no longer exists" }, { status: 400 });
    }
    data.vendorId = vid;
  }
  if (b.status !== undefined) data.status = b.status === "completed" ? "completed" : "pending";
  if (b.discountPct !== undefined) data.discountPct = Number(b.discountPct) || 0;
  if (b.roundOff !== undefined) data.roundOff = Number(b.roundOff) || 0;
  if (b.gstMode !== undefined) data.gstMode = b.gstMode === "inter" ? "inter" : "intra";
  if (b.material !== undefined) data.material = cleanMaterial(b.material);
  if (b.deletedAt !== undefined) data.deletedAt = b.deletedAt === null ? null : new Date(b.deletedAt);

  // A PO can only be Completed once it has a vendor and a PO number.
  if (data.status === "completed") {
    const current = await prisma.purchaseOrder.findFirst({ where: { id, deletedAt: null } });
    const vendorId = (data.vendorId as string | undefined) ?? current?.vendorId ?? "";
    const poNumber = (data.poNumber as string | undefined) ?? current?.poNumber ?? "";
    if (!vendorId || !poNumber) return NextResponse.json({ error: "Add a vendor and a PO number before marking it Completed" }, { status: 400 });
  }

  const po = await prisma.$transaction(async (tx) => {
    if (Array.isArray(b.lines)) {
      await tx.purchaseOrderLine.deleteMany({ where: { poId: id } });
      await tx.purchaseOrderLine.createMany({ data: cleanLines(b.lines).map((l) => ({ ...l, poId: id })) });
    }
    return tx.purchaseOrder.update({ where: { id }, data, include: { lines: true } });
  });
  const vendor = await prisma.vendor.findUnique({ where: { id: po.vendorId } });
  return NextResponse.json(serializePurchaseOrder(po, vendor?.name ?? ""));
}

// Soft delete, like the rest of the app.
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole(ROLES);
  if (auth.response) return auth.response;
  const { id } = await params;
  await prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
