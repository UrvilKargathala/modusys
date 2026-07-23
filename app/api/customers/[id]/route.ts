import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeCustomer } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeCustomer(c));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["name","prefix","firstName","lastName","customerCode","mobile","email","gst","address","city","state","postcode","birthdayMonth","birthdayDay","birthdayYear","stage","assignee","daysInStage","finalOfferLakh"] as const) {
    if (b[k] !== undefined) data[k] = b[k];
  }
  // Keep the display `name` in sync when first/last change.
  if (b.firstName !== undefined || b.lastName !== undefined) {
    const first = (b.firstName ?? "").trim();
    const last = (b.lastName ?? "").trim();
    const composed = [first, last].filter(Boolean).join(" ");
    if (composed) data.name = composed;
  }
  if (b.deletedAt !== undefined) data.deletedAt = b.deletedAt === null ? null : new Date(b.deletedAt);
  if (b.stage !== undefined || b.touch) data.lastActivity = new Date();
  const c = await prisma.customer.update({ where: { id }, data });
  return NextResponse.json(serializeCustomer(c));
}

// Soft delete — matches the app's customer soft-delete + Undo pattern.
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
