import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/require-user";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Used on every page load to answer "who's signed in" — returns { user: null }
// rather than 401 when there's no session, since "not signed in" is a normal
// state for this endpoint, not an error.
export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
    },
  });
}
