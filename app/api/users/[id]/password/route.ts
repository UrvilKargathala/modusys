import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeUser } from "@/lib/server/serialize";
import { hashPassword } from "@/lib/server/password";
import { requireRole } from "@/lib/server/require-user";
import { passwordMeetsAllRequirements } from "@/components/auth/password-requirements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Super-admin-only "Set Password" action from the Users table — directly
// overrides the target user's password, no confirmation from them required.
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const requireChange = body?.requireChange === true;
  if (!passwordMeetsAllRequirements(password)) {
    return NextResponse.json({ error: "Password doesn't meet all requirements" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: requireChange,
      passwordUpdatedAt: new Date(),
      sessionVersion: { increment: 1 },
    },
  });
  return NextResponse.json(serializeUser(user));
}
