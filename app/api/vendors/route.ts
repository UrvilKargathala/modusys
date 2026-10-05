import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeVendor } from "@/lib/server/serialize";
import { requireRole } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = ["super-admin", "admin"];

type ContactIn = { name?: string; phone?: string };
const cleanContacts = (c: unknown) =>
  (Array.isArray(c) ? (c as ContactIn[]) : [])
    .map((x) => ({ name: String(x.name ?? "").trim(), phone: String(x.phone ?? "").trim() }))
    .filter((x) => x.name || x.phone);

export async function GET() {
  const auth = await requireRole(ROLES);
  if (auth.response) return auth.response;
  const vendors = await prisma.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  return NextResponse.json(vendors.map(serializeVendor));
}

export async function POST(req: Request) {
  const auth = await requireRole(ROLES);
  if (auth.response) return auth.response;
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
  const vendor = await prisma.vendor.create({
    data: {
      name,
      address: b.address ?? "",
      city: b.city ?? "",
      state: b.state ?? "",
      gst: String(b.gst ?? "").trim().toUpperCase(),
      contacts: cleanContacts(b.contacts),
    },
  });
  return NextResponse.json(serializeVendor(vendor), { status: 201 });
}
