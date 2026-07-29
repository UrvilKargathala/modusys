import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function effectiveRole(role: string) {
  return role === "no-role" ? "staff" : role;
}

function serialize(row: {
  id: string; title: string; description: string; dueDate: string;
  priority: string; status: string; assigneeId: string; createdById: string;
  linkedCustomerId: string | null; createdAt: Date; updatedAt: Date; completedAt: Date | null;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    priority: row.priority,
    assigneeId: row.assigneeId,
    createdById: row.createdById,
    customerId: row.linkedCustomerId,
    completed: row.status === "completed",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const role = effectiveRole(auth.user.role);
  const canEditAny = role === "super-admin" || role === "admin";

  const { id } = await params;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Staff can only touch tasks assigned to them, and only the status flag —
  // enforcing that at the query layer, not just hiding UI buttons.
  if (!canEditAny) {
    if (existing.assigneeId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const allowedKeys = ["status", "completed"];
    const extraKeys = Object.keys(b).filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      return NextResponse.json({ error: "Staff can only change task status" }, { status: 403 });
    }
  }

  const data: Record<string, unknown> = {};
  if (typeof b.title === "string" && canEditAny) data.title = b.title.trim();
  if (typeof b.description === "string" && canEditAny) data.description = b.description;
  if (typeof b.dueDate === "string" && canEditAny) data.dueDate = b.dueDate;
  if (typeof b.priority === "string" && canEditAny) data.priority = b.priority;
  if (typeof b.assigneeId === "string" && b.assigneeId && canEditAny) data.assigneeId = b.assigneeId;
  if ("linkedCustomerId" in b && canEditAny) {
    data.linkedCustomerId = typeof b.linkedCustomerId === "string" && b.linkedCustomerId ? b.linkedCustomerId : null;
  }

  // Accept either { status: "pending"|"completed" } or { completed: boolean }
  // so the existing client toggleComplete() call works verbatim.
  let nextStatus: string | undefined;
  if (b.status === "pending" || b.status === "completed") nextStatus = b.status;
  else if (typeof b.completed === "boolean") nextStatus = b.completed ? "completed" : "pending";
  if (nextStatus && nextStatus !== existing.status) {
    data.status = nextStatus;
    data.completedAt = nextStatus === "completed" ? new Date() : null;
  }

  const row = await prisma.task.update({ where: { id }, data });
  return NextResponse.json(serialize(row));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const role = effectiveRole(auth.user.role);

  const { id } = await params;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (role === "super-admin") {
    // full permission
  } else if (role === "admin") {
    if (existing.createdById !== auth.user.id) {
      return NextResponse.json({ error: "Admins can only delete tasks they created" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Staff cannot delete tasks" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
