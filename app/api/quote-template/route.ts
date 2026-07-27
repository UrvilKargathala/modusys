import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser, requireRole } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shape(s: { layout: unknown; branding: unknown; banking: unknown; signature: unknown; notes: unknown; terms: unknown; paymentTerms: unknown }) {
  return { layout: s.layout, branding: s.branding, banking: s.banking, signature: s.signature, notes: s.notes, terms: s.terms, paymentTerms: s.paymentTerms };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const s = await prisma.quoteTemplateSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(s ? shape(s) : null);
}

// Replace the whole singleton settings row.
export async function PUT(req: Request) {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;
  const b = await req.json();
  const data = {
    layout: b.layout, branding: b.branding, banking: b.banking, signature: b.signature,
    notes: b.notes ?? [], terms: b.terms ?? [], paymentTerms: b.paymentTerms ?? [],
  };
  const s = await prisma.quoteTemplateSettings.upsert({
    where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data,
  });
  return NextResponse.json(shape(s));
}
