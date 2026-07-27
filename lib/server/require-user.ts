import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/server/session-token";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

// Resolves the caller from the signed session cookie, re-checking the DB
// each time (not just trusting the token) so a deactivated user's existing
// cookie stops working immediately.
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = verifySessionToken(store.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "active") return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
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
