import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { hashPassword, verifyPassword } from "@backend/server/password";
import { requireUser } from "@backend/server/require-user";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@backend/server/session-token";
import { passwordMeetsAllRequirements } from "@/components/auth/password-requirements";
import { logSecurityAudit } from "@backend/server/audit-log";
import { logAudit } from "@backend/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-service password change for the signed-in user.
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Missing current or new password" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
  }
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
  }

  if (!passwordMeetsAllRequirements(newPassword)) {
    return NextResponse.json({ error: "Password doesn't meet all requirements" }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordUpdatedAt: new Date(),
      sessionVersion: { increment: 1 },
    },
  });

  await logSecurityAudit({
    actorUserId: updated.id,
    actorName: updated.name,
    action: "PASSWORD_CHANGED_SELF",
  });
  void logAudit({
    action: "USER_PASSWORD_CHANGED_SELF",
    actor: { id: updated.id, email: updated.email, name: updated.name },
    target: { type: "USER", id: updated.id, label: updated.email },
    req,
  });

  // Rotate the session token so any other device holding the old token
  // stops being able to act as this user.
  const token = createSessionToken(updated.id, updated.sessionVersion);
  const sessionUser = {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    status: updated.status,
    mustChangePassword: updated.mustChangePassword,
  };

  // Mobile: the old Bearer token is now dead, so hand back the new one.
  if (body?.client === "mobile") {
    return NextResponse.json({ user: sessionUser, token });
  }

  const res = NextResponse.json({ user: sessionUser });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
