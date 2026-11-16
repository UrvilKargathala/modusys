import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./session-token";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
};

// Resolves the caller from the signed session token, re-checking the DB
// each time (not just trusting the token) so a deactivated user's existing
// token stops working immediately. The web sends the token in the httpOnly
// cookie; the mobile app sends the same token as "Authorization: Bearer".
// Browsers never attach a Bearer header on their own, so this adds no CSRF risk.
export async function getSessionUser(): Promise<SessionUser | null> {
  const authHeader = (await headers()).get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const token = bearer || (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "active") return null;
  if (user.sessionVersion !== session.sessionVersion) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
  };
}

// Call at the top of every API route handler that requires a signed-in user.
// Usage: const auth = await requireUser(); if (auth.response) return auth.response;
export async function requireUser(): Promise<
  { user: SessionUser; response: null } | { user: null; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

// Stricter variant for endpoints only certain roles may call (e.g. deletes,
// user management) — mirrors the same role gates already enforced in the UI.
export async function requireRole(
  roles: string[]
): Promise<{ user: SessionUser; response: null } | { user: null; response: NextResponse }> {
  const auth = await requireUser();
  if (auth.response) return auth;
  if (!roles.includes(auth.user.role)) {
    return { user: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}
