import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeCustomer } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Optional ?stage= and ?q= filters mirror what the CRM/Customers list expose.
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const q = searchParams.get("q");
  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      ...(stage ? { stage } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(customers.map(serializeCustomer));
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const b = await req.json();
  const firstName = (b.firstName ?? "").trim();
  const lastName = (b.lastName ?? "").trim();
  // The display `name` stays the composite so every existing consumer (CRM
  // board, tables, quotes) keeps working. If the legacy single `name` is sent
  // (e.g. an older caller), fall back to it.
  const name = [firstName, lastName].filter(Boolean).join(" ") || (b.name ?? "");
  const customerCode = (b.customerCode ?? `${firstName[0] ?? ""}${lastName[0] ?? ""}`).toUpperCase();
  // Serial number is assigned authoritatively here (max + 1) so concurrent
  // adds can't collide on a client-computed value.
  const max = await prisma.customer.aggregate({ _max: { srNo: true } });
  const srNo = (max._max.srNo ?? 0) + 1;

  const customer = await prisma.customer.create({
    data: {
      name,
      prefix: b.prefix ?? "",
      firstName,
      lastName,
      srNo,
      customerCode,
      mobile: b.mobile ?? "",
      email: b.email ?? "",
      gst: b.gst ?? "",
      address: b.address ?? "",
      city: b.city ?? "",
      state: b.state ?? "",
      postcode: b.postcode ?? "",
      birthdayMonth: b.birthdayMonth ?? "",
      birthdayDay: b.birthdayDay ?? "",
      birthdayYear: b.birthdayYear ?? "",
      stage: b.stage ?? "upcoming-inquiry",
      assignee: b.assignee ?? "",
      createdById: b.createdById ?? null,
    },
  });
  return NextResponse.json(serializeCustomer(customer), { status: 201 });
}
