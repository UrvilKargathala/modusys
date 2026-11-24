import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { serializeUser } from "@backend/server/serialize";
import { hashPassword } from "@backend/server/password";
import { encryptPassword } from "@backend/server/password-vault";
import { passwordMeetsAllRequirements } from "@/components/auth/password-requirements";
import { requireUser, requireRole } from "@backend/server/require-user";
import { logSecurityAudit } from "@backend/server/audit-log";
import { logAudit } from "@backend/server/audit";

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
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  // Sign-in lowercases the typed email, so store it lowercased too.
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role : "no-role";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  if (!passwordMeetsAllRequirements(password)) {
    return NextResponse.json({ error: "Password doesn't meet all requirements" }, { status: 400 });
  }
  // Only a Super Admin may create another Super Admin.
  if (role === "super-admin" && auth.user.role !== "super-admin") {
    return NextResponse.json({ error: "Only a Super Admin can add a Super Admin" }, { status: 403 });
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // "invited" until their first successful sign-in flips it to "active".
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      status: "invited",
      passwordHash: await hashPassword(password),
      passwordEncrypted: encryptPassword(password),
      passwordUpdatedAt: new Date(),
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
