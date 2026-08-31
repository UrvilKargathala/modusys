import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function describe(action: string, actorName: string, targetName: string | null) {
  switch (action) {
    case "PASSWORD_CHANGED_SELF":
      return `${actorName} changed their own password`;
    case "PASSWORD_SET_BY_ADMIN":
      return `${actorName} set a new password for ${targetName}`;
    case "USER_INVITED":
      return `${actorName} invited ${targetName}`;
    case "ROLE_CHANGED":
      return `${actorName} changed ${targetName}'s role`;
    default:
      return `${actorName} performed ${action}`;
  }
}

// Super-admin-only — surfaces the last 20 security-relevant actions on the
// Users page ("Recent security actions").
export async function GET() {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;

  const events = await prisma.securityAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    events.map((e) => ({
      id: e.id,
      action: e.action,
      message: describe(e.action, e.actorName, e.targetName),
      createdAt: e.createdAt.toISOString(),
    }))
  );
}
