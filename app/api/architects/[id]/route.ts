import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeArchitect } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const a = await prisma.architect.findUnique({ where: { id }, include: { partners: true } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeArchitect(a));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["prefix","firstName","lastName","mobile","office","company","instagram","address","city","state","postcode","birthdayMonth","birthdayDay","birthdayYear"] as const) {
    if (b[k] !== undefined) data[k] = b[k];
  }
  if (b.deletedAt !== undefined) data.deletedAt = b.deletedAt === null ? null : new Date(b.deletedAt);
  // Partners are replace-all when provided (matches the form's edit semantics).
  if (Array.isArray(b.partners)) {
    await prisma.architectPartner.deleteMany({ where: { architectId: id } });
    data.partners = { create: b.partners.map((name: string) => ({ name })) };
  }
  const a = await prisma.architect.update({ where: { id }, data, include: { partners: true } });
  return NextResponse.json(serializeArchitect(a));
}

// Soft delete — matches the app's established soft-delete + Undo pattern.
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await prisma.architect.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
