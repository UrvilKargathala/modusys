import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireUser, requireRole } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shape(s: { layout: unknown; branding: unknown; banking: unknown; signature: unknown; notes: unknown; terms: unknown; paymentTerms: unknown }) {
  return { layout: s.layout, branding: s.branding, banking: s.banking, signature: s.signature, notes: s.notes, terms: s.terms, paymentTerms: s.paymentTerms };
}

// ?kind=purchase = the Purchase Template (its own row, id "purchase"); otherwise the Quote Template ("singleton").
// Until a purchase template has been saved, it reads as a copy of the quote template, so nothing changes by itself.
const rowId = (req: Request) => (new URL(req.url).searchParams.get("kind") === "purchase" ? "purchase" : "singleton");

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const id = rowId(req);
  const s =
    (await prisma.quoteTemplateSettings.findUnique({ where: { id } })) ??
    (id === "purchase" ? await prisma.quoteTemplateSettings.findUnique({ where: { id: "singleton" } }) : null);
  return NextResponse.json(s ? shape(s) : null);
}

// Replace the whole settings row.
export async function PUT(req: Request) {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;
  const b = await req.json();
  const data = {
    layout: b.layout, branding: b.branding, banking: b.banking, signature: b.signature,
    notes: b.notes ?? [], terms: b.terms ?? [], paymentTerms: b.paymentTerms ?? [],
  };
  const id = rowId(req);
  const s = await prisma.quoteTemplateSettings.upsert({
    where: { id }, create: { id, ...data }, update: data,
  });
  void logAudit({
    action: "QUOTE_TEMPLATE_SETTING_UPDATED",
    actor: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    target: { type: "QUOTE_TEMPLATE_SETTING", id, label: id === "purchase" ? "Purchase Template Settings" : "Quote Template Settings" },
    details: { fields: Object.keys(data) },
    req,
  });
  return NextResponse.json(shape(s));
}
