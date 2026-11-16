import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@backend/server/session-token";
import { getSessionUser } from "@backend/server/require-user";
import { logAudit } from "@backend/server/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (user) {
    void logAudit({
      action: "SIGN_OUT",
      actor: { id: user.id, email: user.email, name: user.name },
      target: { type: "SESSION" },
      req,
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
