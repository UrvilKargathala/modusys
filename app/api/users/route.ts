import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeUser } from "@/lib/server/serialize";
import { requireUser, requireRole } from "@/lib/server/require-user";
import { logSecurityAudit } from "@/lib/server/audit-log";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(users.map(serializeUser));
}

// Invite a new user — matches "Admin: Invite users and assign non-admin
// roles" / "Super Admin: full user management" from lib/constants/roles.ts.
export async function POST(req: Request) {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;
  const body = await req.json();
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      role: body.role ?? "no-role",
      status: body.status ?? "invited",
    },
  });

  await logSecurityAudit({
    actorUserId: auth.user.id,
    actorName: auth.user.name,
    action: "USER_INVITED",
    targetUserId: user.id,
    targetName: user.name,
  });
  void logAudit({
    action: "USER_INVITED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "USER", id: user.id, label: `${user.name} (${user.email})` },
    details: { role: user.role },
    req,
  });

  return NextResponse.json(serializeUser(user), { status: 201 });
}
