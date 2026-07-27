import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(q: Record<string, unknown> & { createdAt: Date; updatedAt: Date }) {
  return { ...q, createdAt: q.createdAt.toISOString(), updatedAt: q.updatedAt.toISOString() };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const quotes = await prisma.quote.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(quotes.map(serialize));
}

// Upsert a single quote (the store's saveQuote handles both create and update).
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const b = await req.json();
  const data = {
    quoteNumber: b.quoteNumber, date: b.date ?? "", customerId: b.customerId ?? null,
    architectId: b.architectId ?? null, revision: b.revision ?? 0, productTypeId: b.productTypeId ?? "",
    status: b.status ?? "draft", markupMultiplier: b.markupMultiplier ?? 1,
    materialDescriptionId: b.materialDescriptionId ?? "", shutterFinishId: b.shutterFinishId ?? "",
    handleTypeId: b.handleTypeId ?? "", hingesTypeId: b.hingesTypeId ?? "",
    clientResponsibilityId: b.clientResponsibilityId ?? "",
    tandemDrawerTypeId: b.tandemDrawerTypeId ?? "",
    units: b.units ?? [],
    specialDiscountPct: b.specialDiscountPct ?? 0,
    installationFreightIncluded: b.installationFreightIncluded ?? true,
    finishOptions: b.finishOptions ?? [],
  };
  const quote = await prisma.quote.upsert({
    where: { id: b.id }, create: { id: b.id, ...data }, update: data,
  });
  return NextResponse.json(serialize(quote), { status: 201 });
}
