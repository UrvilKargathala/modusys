import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeVendor } from "@/lib/server/serialize";
import { requireRole } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const ROLES = ["super-admin", "admin"];

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(ROLES);
  if (auth.response) return auth.response;
  const { id } = await params;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["name", "address", "city", "state"] as const) {
    if (b[k] !== undefined) data[k] = b[k];
  }
  if (b.gst !== undefined) data.gst = String(b.gst).trim().toUpperCase();
  if (Array.isArray(b.contacts)) {
    data.contacts = (b.contacts as { name?: string; phone?: string }[])
      .map((x) => ({ name: String(x.name ?? "").trim(), phone: String(x.phone ?? "").trim() }))
      .filter((x) => x.name || x.phone);
  }
  if (b.deletedAt !== undefined) data.deletedAt = b.deletedAt === null ? null : new Date(b.deletedAt);
  if (data.name !== undefined && !String(data.name).trim()) {
    return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
  }
  const vendor = await prisma.vendor.update({ where: { id }, data });
  return NextResponse.json(serializeVendor(vendor));
}

// Soft delete + Undo, like architects/customers. POs keep their vendorId.
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;
  const { id } = await params;
  await prisma.vendor.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
