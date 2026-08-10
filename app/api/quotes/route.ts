import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

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

  const existing = b.id ? await prisma.quote.findUnique({ where: { id: b.id } }) : null;

  const data = {
    quoteNumber: b.quoteNumber, date: b.date ?? "", customerId: b.customerId ?? null,
    architectId: b.architectId ?? null, revision: b.revision ?? 0,
    propertyTypeId: b.propertyTypeId ?? "", salesExecutiveId: b.salesExecutiveId ?? "",
    designerId: b.designerId ?? "", siteEngineerId: b.siteEngineerId ?? "",
    productTypeId: b.productTypeId ?? "",
    status: b.status ?? "draft", markupMultiplier: b.markupMultiplier ?? 1,
    materialDescriptionId: b.materialDescriptionId ?? "", shutterFinishId: b.shutterFinishId ?? "",
    handleTypeId: b.handleTypeId ?? "", hingesTypeId: b.hingesTypeId ?? "",
    clientResponsibilityId: b.clientResponsibilityId ?? "",
    tandemDrawerTypeId: b.tandemDrawerTypeId ?? "",
    units: b.units ?? [],
    specialDiscountPct: b.specialDiscountPct ?? 0,
    installationFreightIncluded: b.installationFreightIncluded ?? true,
    installationFreightCost: b.installationFreightCost ?? 0,
    remark: b.remark ?? "",
    finishOptions: b.finishOptions ?? [],
  };
  const quote = await prisma.quote.upsert({
    where: { id: b.id }, create: { id: b.id, ...data }, update: data,
  });

  const actor = { id: auth.user.id, email: auth.user.email, name: auth.user.name };
  if (!existing) {
    void logAudit({
      action: "QUOTE_CREATED",
      actor,
      target: { type: "QUOTE", id: quote.id, label: quote.quoteNumber },
      req,
    });
  } else if (existing.status !== quote.status) {
    void logAudit({
      action: "QUOTE_STATUS_CHANGED",
      actor,
      target: { type: "QUOTE", id: quote.id, label: quote.quoteNumber },
      details: { field: "status", from: existing.status, to: quote.status },
      req,
    });
  } else {
    void logAudit({
      action: "QUOTE_UPDATED",
      actor,
      target: { type: "QUOTE", id: quote.id, label: quote.quoteNumber },
      req,
    });
  }

  return NextResponse.json(serialize(quote), { status: 201 });
}
