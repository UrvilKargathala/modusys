import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { getCurrentEmployee } from "@/lib/server/current-employee";

export const dynamic = "force-dynamic";

async function assertOwnOrAdmin(id: string) {
  const user = await getSessionUser();
  if (!user) return { user: null, leave: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) return { user, leave: null, error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const isAdmin = user.role === "super-admin";
  if (!isAdmin) {
    const { employee } = await getCurrentEmployee();
    if (!employee || employee.id !== leave.employeeId) {
      return { user, leave: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }
  return { user, leave, error: null as null };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { leave, error } = await assertOwnOrAdmin(id);
  if (error) return error;
  return NextResponse.json({ leave });
}

// Approve / reject — super-admin only.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim() || null : null;
  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "status must be APPROVED or REJECTED" }, { status: 400 });
  }

  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: `Already ${existing.status.toLowerCase()}` }, { status: 409 });
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: { status, reviewNote, reviewedAt: new Date(), reviewedBy: user.id },
  });
  return NextResponse.json({ ok: true, leave: updated });
}

// Employee cancels their own PENDING leave.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { leave, error } = await assertOwnOrAdmin(id);
  if (error) return error;
  if (leave!.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending leaves can be cancelled" }, { status: 409 });
  }
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED", reviewedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
