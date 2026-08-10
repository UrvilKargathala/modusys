import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeCustomer } from "@/lib/server/serialize";
import { requireUser, requireRole } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeCustomer(c));
}

// requireUser (not requireRole) — this also handles Kanban stage drag/drop,
// which any signed-in user can do, not just admins (matches the Pipeline
// board having no role gate on moving a card).
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
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
  void logAudit({
    action: "CUSTOMER_UPDATED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "CUSTOMER", id: c.id, label: `${c.name}${c.city ? ` — ${c.city}` : ""}` },
    details: { fields: Object.keys(data) },
    req,
  });
  return NextResponse.json(serializeCustomer(c));
}

// Soft delete — matches the app's customer soft-delete + Undo pattern.
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;
  const { id } = await params;
  const c = await prisma.customer.findUnique({ where: { id } });
  await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  void logAudit({
    action: "CUSTOMER_DELETED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "CUSTOMER", id, label: c ? `${c.name}${c.city ? ` — ${c.city}` : ""}` : id },
    req,
  });
  return NextResponse.json({ ok: true });
}
