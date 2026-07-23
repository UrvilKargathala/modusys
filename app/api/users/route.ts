import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeUser } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(users.map(serializeUser));
}

export async function POST(req: Request) {
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
