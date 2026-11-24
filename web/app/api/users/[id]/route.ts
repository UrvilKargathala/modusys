import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { serializeUser } from "@backend/server/serialize";
import { requireUser } from "@backend/server/require-user";
import { logSecurityAudit } from "@backend/server/audit-log";
import { logAudit } from "@backend/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeUser(user));
}

// A user may PATCH their own record (used by the forced-change-password flow
// to clear mustChangePassword on themselves) without being an admin. Editing
// someone else, or changing any role, requires super-admin — matches
// users-table.tsx's canEditUser/canSetPassword, both super-admin-only.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await req.json();

  const isSelf = auth.user.id === id;
  const changingRole = body.role !== undefined;
  const changingStatus = body.status !== undefined;
  if ((!isSelf || changingRole || changingStatus) && auth.user.role !== "super-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (changingStatus) {
    if (body.status !== "active" && body.status !== "inactive") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (isSelf) {
      return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 });
    }
  }

  const before = changingRole ? await prisma.user.findUnique({ where: { id } }) : null;

  const data: Record<string, unknown> = {};
  for (const k of ["name", "email", "role", "status", "mustChangePassword"] as const) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.passwordUpdatedAt !== undefined) data.passwordUpdatedAt = new Date();
  // Deactivating signs the person out on every device straight away.
  if (body.status === "inactive") data.sessionVersion = { increment: 1 };
  if (typeof data.email === "string") {
    const taken = await prisma.user.findFirst({ where: { email: data.email, NOT: { id } }, select: { id: true } });
    if (taken) return NextResponse.json({ error: "That email is already used by another user." }, { status: 409 });
  }
  const user = await prisma.user.update({ where: { id }, data });

  if (changingRole && before && before.role !== user.role) {
    await logSecurityAudit({
      actorUserId: auth.user.id,
      actorName: auth.user.name,
      action: "ROLE_CHANGED",
      targetUserId: user.id,
      targetName: user.name,
    });
    void logAudit({
      action: "USER_ROLE_CHANGED",
      actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
      target: { type: "USER", id: user.id, label: `${user.name} (${user.email})` },
      details: { field: "role", from: before.role, to: user.role },
      req,
    });
  }

  if (changingStatus) {
    void logAudit({
      action: body.status === "inactive" ? "USER_DEACTIVATED" : "USER_REACTIVATED",
      actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
      target: { type: "USER", id: user.id, label: `${user.name} (${user.email})` },
      req,
    });
  }

  return NextResponse.json(serializeUser(user));
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  if (auth.user.role !== "super-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  await prisma.user.delete({ where: { id } });
  void logAudit({
    action: "USER_DELETED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "USER", id, label: target ? `${target.name} (${target.email})` : id },
    req,
  });
  return NextResponse.json({ ok: true });
}
