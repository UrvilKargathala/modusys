import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeArchitect } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const architects = await prisma.architect.findMany({
    where: { deletedAt: null },
    include: { partners: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(architects.map(serializeArchitect));
}

export async function POST(req: Request) {
  const b = await req.json();
  const architect = await prisma.architect.create({
    data: {
      prefix: b.prefix ?? "",
      firstName: b.firstName,
      lastName: b.lastName,
      mobile: b.mobile ?? "",
      office: b.office ?? "",
      company: b.company ?? "",
      instagram: b.instagram ?? "",
      address: b.address ?? "",
      city: b.city ?? "",
      state: b.state ?? "",
      postcode: b.postcode ?? "",
      birthdayMonth: b.birthdayMonth ?? "",
      birthdayDay: b.birthdayDay ?? "",
      birthdayYear: b.birthdayYear ?? "",
      createdById: b.createdById ?? null,
      partners: { create: (b.partners ?? []).map((name: string) => ({ name })) },
    },
    include: { partners: true },
  });
  return NextResponse.json(serializeArchitect(architect), { status: 201 });
}
