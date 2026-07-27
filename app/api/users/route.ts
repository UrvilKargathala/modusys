import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeUser } from "@/lib/server/serialize";
import { requireUser, requireRole } from "@/lib/server/require-user";

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
  return NextResponse.json(serializeUser(user), { status: 201 });
}
