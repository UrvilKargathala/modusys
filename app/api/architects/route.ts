import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeArchitect } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const architects = await prisma.architect.findMany({
    where: { deletedAt: null },
    include: { partners: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(architects.map(serializeArchitect));
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
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
      siteEngineers: b.siteEngineers ?? [],
      createdById: b.createdById ?? null,
      partners: {
        create: (b.partners ?? []).map((p: { prefix?: string; firstName?: string; lastName?: string }) => ({
          prefix: p.prefix ?? "",
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
        })),
      },
    },
    include: { partners: true },
  });
  const label = `${[architect.firstName, architect.lastName].filter(Boolean).join(" ")}${architect.company ? ` — ${architect.company}` : ""}`;
  void logAudit({
    action: "ARCHITECT_CREATED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "ARCHITECT", id: architect.id, label },
    req,
  });
  return NextResponse.json(serializeArchitect(architect), { status: 201 });
}
