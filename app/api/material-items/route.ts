import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { replaceCollection, toDate } from "@/lib/server/bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.materialItem.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(items.map((i) => ({
    id: i.id, category: i.category, name: i.name, description: i.description,
    deleted: i.deleted, createdAt: i.createdAt.toISOString(),
  })));
}

// Bulk id-preserving replace (last-write-wins). Body: MaterialItem[].
export async function PUT(req: Request) {
  const rows = (await req.json()) as Array<Record<string, unknown>>;
  await replaceCollection(prisma.materialItem, rows.map((r) => ({
    id: String(r.id), category: String(r.category), name: String(r.name),
    description: String(r.description ?? ""), deleted: Boolean(r.deleted),
    createdAt: toDate(r.createdAt),
  })));
  return NextResponse.json({ ok: true });
}
