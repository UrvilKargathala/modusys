import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { verifyPassword } from "@backend/server/password";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@backend/server/session-token";
import { logAudit } from "@backend/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generic message for every failure branch (unknown email, no password set,
// wrong password, inactive account) — never reveal which part was wrong.
// A fresh response each time: a response body can only be sent once, so a
// shared one would go out empty after the first failed sign-in.
const invalid = () => NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return invalid();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || user.status !== "active") return invalid();

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    void logAudit({ action: "SIGN_IN_FAILURE", actorEmail: email, target: { type: "SESSION" }, req, result: "FAILURE" });
    return invalid();
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastActive: new Date() } });

  void logAudit({
    action: "SIGN_IN_SUCCESS",
    actor: { id: user.id, email: user.email, name: user.name },
    target: { type: "SESSION" },
    req,
  });

  const token = createSessionToken(user.id, user.sessionVersion);
  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
  };

  // The mobile app has no cookie jar: it gets the token in the body and sends
  // it back as "Authorization: Bearer". The web keeps the httpOnly cookie only.
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
