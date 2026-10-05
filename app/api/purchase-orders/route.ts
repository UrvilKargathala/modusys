import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializePurchaseOrder } from "@/lib/server/serialize";
import { requireRole } from "@/lib/server/require-user";

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
