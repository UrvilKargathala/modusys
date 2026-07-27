import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeUser } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";

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
  if ((!isSelf || changingRole) && auth.user.role !== "super-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  for (const k of ["name", "email", "role", "status", "mustChangePassword"] as const) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.passwordUpdatedAt !== undefined) data.passwordUpdatedAt = new Date();
  const user = await prisma.user.update({ where: { id }, data });
  return NextResponse.json(serializeUser(user));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  if (auth.user.role !== "super-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
