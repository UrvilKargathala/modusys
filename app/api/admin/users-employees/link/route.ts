import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

// POST { userId, employeeId } — link. { userId, employeeId: null } — unlink.
// employeeId is @unique on User so Prisma enforces one-employee-per-user.
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId ?? "");
  const employeeId: string | null = body?.employeeId ?? null;
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, employeeId: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true } });
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    // Someone else already claims this employee? Reject — @unique would throw
    // otherwise; explicit error is friendlier.
    const collision = await prisma.user.findFirst({ where: { employeeId, NOT: { id: userId } }, select: { name: true } });
    if (collision) {
      return NextResponse.json({ error: `Already linked to ${collision.name}` }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { employeeId },
    select: { id: true, name: true, employeeId: true },
  });

  void logAudit({
    action: employeeId ? "USER_EMPLOYEE_LINKED" : "USER_EMPLOYEE_UNLINKED",
    actor: { id: me.id, email: me.email, name: me.name },
    target: { type: "USER", id: user.id, label: user.name },
    details: employeeId
      ? { linkedEmployeeId: employeeId, from: user.employeeId ?? null }
      : { unlinkedEmployeeId: user.employeeId },
    req,
  });

  return NextResponse.json({ ok: true, user: updated });
}
