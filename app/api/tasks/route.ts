import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Normalised app roles ("no-role" collapses to "staff" everywhere the UI
// touches tasks, matching what tasks-tab.tsx already does).
function effectiveRole(role: string) {
  return role === "no-role" ? "staff" : role;
}

// Shape the Prisma row for the client — keep the same field names the
// existing tasks-store client Task type uses so no UI code has to change:
// completed:boolean instead of status, customerId instead of linkedCustomerId.
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

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const role = effectiveRole(auth.user.role);
  // Only super-admin gets the org-wide view. Admin and staff both see just
  // their own tasks (assigned to them or created by them, later filtered on
  // the client via visibleTasks).
  const canSeeAll = role === "super-admin";

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "all"; // pending | completed | all
  const assigneeParam = url.searchParams.get("assigneeId") ?? "all"; // me | <userId> | all

  // Staff can only see their own tasks — reject any query that would return
  // someone else's work, no matter how the client asked.
  if (!canSeeAll) {
    if (assigneeParam !== "all" && assigneeParam !== "me" && assigneeParam !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const where: Record<string, unknown> = {};
  if (statusParam === "pending") where.status = "pending";
  else if (statusParam === "completed") where.status = "completed";

  if (assigneeParam === "me") {
    where.assigneeId = auth.user.id;
  } else if (assigneeParam !== "all") {
    where.assigneeId = assigneeParam;
  } else if (!canSeeAll) {
    // Staff with assigneeParam="all" still gets narrowed to themselves.
    where.assigneeId = auth.user.id;
  }

  const rows = await prisma.task.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(rows.map(serialize));
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const role = effectiveRole(auth.user.role);
  // Only super-admin can delegate. Admin and staff can only create tasks
  // assigned to themselves — matches the "admin sees only their own tasks"
  // policy (delegating to someone whose tasks you can't see is nonsensical).
  const canAssignOthers = role === "super-admin";

  const b = await req.json().catch(() => null);
  if (!b || typeof b.title !== "string" || !b.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const assigneeId = typeof b.assigneeId === "string" && b.assigneeId ? b.assigneeId : auth.user.id;

  if (!canAssignOthers && assigneeId !== auth.user.id) {
    return NextResponse.json({ error: "You can only assign tasks to yourself" }, { status: 403 });
  }

  const row = await prisma.task.create({
    data: {
      title: b.title.trim(),
      description: typeof b.description === "string" ? b.description : "",
      dueDate: typeof b.dueDate === "string" ? b.dueDate : "",
      priority: typeof b.priority === "string" ? b.priority : "normal",
      status: "pending",
      assigneeId,
      createdById: auth.user.id,
      linkedCustomerId: typeof b.linkedCustomerId === "string" && b.linkedCustomerId ? b.linkedCustomerId : null,
    },
  });

  // Notify the assignee — but only when it's actually a delegation (someone
  // self-assigning shouldn't ping themselves).
  if (assigneeId !== auth.user.id) {
    await prisma.notification.create({
      data: {
        userId: assigneeId,
        type: "assigned",
        relatedTaskId: row.id,
        message: `${auth.user.name} assigned you a task: "${row.title}"`,
      },
    });
  }

  void logAudit({
    action: "TASK_CREATED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "TASK", id: row.id, label: row.title },
    details: { assigneeId, priority: row.priority },
    req,
  });

  return NextResponse.json(serialize(row), { status: 201 });
}
