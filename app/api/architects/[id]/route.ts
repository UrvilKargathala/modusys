import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeArchitect } from "@/lib/server/serialize";
import { requireUser, requireRole } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const a = await prisma.architect.findUnique({ where: { id }, include: { partners: true } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeArchitect(a));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;
  const { id } = await params;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["prefix","firstName","lastName","mobile","office","company","instagram","address","city","state","postcode","birthdayMonth","birthdayDay","birthdayYear"] as const) {
    if (b[k] !== undefined) data[k] = b[k];
  }
  if (b.deletedAt !== undefined) data.deletedAt = b.deletedAt === null ? null : new Date(b.deletedAt);
  if (Array.isArray(b.siteEngineers)) {
    data.siteEngineers = b.siteEngineers.map((s: { prefix?: string; firstName?: string; lastName?: string; mobile?: string }) => ({
      prefix: s.prefix ?? "",
      firstName: s.firstName ?? "",
      lastName: s.lastName ?? "",
      mobile: s.mobile ?? "",
    }));
  }
  // Partners are replace-all when provided (matches the form's edit semantics).
  if (Array.isArray(b.partners)) {
    await prisma.architectPartner.deleteMany({ where: { architectId: id } });
    data.partners = {
      create: b.partners.map((p: { prefix?: string; firstName?: string; lastName?: string; mobile?: string }) => ({
        prefix: p.prefix ?? "",
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
        mobile: p.mobile ?? "",
      })),
    };
  }
  const a = await prisma.architect.update({ where: { id }, data, include: { partners: true } });
  const label = `${[a.firstName, a.lastName].filter(Boolean).join(" ")}${a.company ? ` — ${a.company}` : ""}`;
  void logAudit({
    action: "ARCHITECT_UPDATED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "ARCHITECT", id: a.id, label },
    details: { fields: Object.keys(data) },
    req,
  });
  return NextResponse.json(serializeArchitect(a));
}

// Soft delete — matches the app's established soft-delete + Undo pattern.
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;
  const { id } = await params;
  const a = await prisma.architect.findUnique({ where: { id } });
  await prisma.architect.update({ where: { id }, data: { deletedAt: new Date() } });
  const label = a ? `${[a.firstName, a.lastName].filter(Boolean).join(" ")}${a.company ? ` — ${a.company}` : ""}` : id;
  void logAudit({
    action: "ARCHITECT_DELETED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "ARCHITECT", id, label },
    req,
  });
  return NextResponse.json({ ok: true });
}
