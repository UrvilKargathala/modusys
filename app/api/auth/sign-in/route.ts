import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { verifyPassword } from "@/lib/server/password";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/server/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generic message for every failure branch (unknown email, no password set,
// wrong password, inactive account) — never reveal which part was wrong.
const INVALID = NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return INVALID;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || user.status !== "active") return INVALID;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return INVALID;

  await prisma.user.update({ where: { id: user.id }, data: { lastActive: new Date() } });

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
    },
  });
  res.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
