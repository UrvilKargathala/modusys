import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeUser } from "@/lib/server/serialize";
import { hashPassword } from "@/lib/server/password";
import { requireRole } from "@/lib/server/require-user";
import { passwordMeetsAllRequirements } from "@/components/auth/password-requirements";
import { logSecurityAudit } from "@/lib/server/audit-log";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Super-admin-only "Set Password" action from the Users table — directly
// overrides the target user's password, no confirmation from them required.
// Does not rotate the target's session cookie (that'd be jarring for them
// mid-session); if requirePasswordChange is set, they're routed through the
// forced-change flow on their next sign-in instead.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const requirePasswordChange = body?.requirePasswordChange === true;
  if (!passwordMeetsAllRequirements(newPassword)) {
    return NextResponse.json({ error: "Password doesn't meet all requirements" }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  const user = await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: requirePasswordChange,
      passwordUpdatedAt: new Date(),
      sessionVersion: { increment: 1 },
    },
  });

  await logSecurityAudit({
    actorUserId: auth.user.id,
    actorName: auth.user.name,
    action: "PASSWORD_SET_BY_ADMIN",
    targetUserId: user.id,
    targetName: user.name,
  });
  void logAudit({
    action: "USER_PASSWORD_SET_BY_ADMIN",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "USER", id: user.id, label: `${user.name} (${user.email})` },
    req,
  });

  return NextResponse.json(serializeUser(user));
}
