import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

// Any signed-in user can read the custom stages list (Kanban + panel picker
// need it).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stages = await prisma.customPipelineStage.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ stages });
}

// Add a new custom stage — super-admin only.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const label = String(body?.label ?? "").trim();
  const color = String(body?.color ?? "grey").trim();
  if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 });

  // Slugify label into a stable key. Reject if it collides with an existing key.
  const key = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  if (!key || key === "custom-") return NextResponse.json({ error: "Label must contain letters or numbers" }, { status: 400 });
  const clash = await prisma.customPipelineStage.findUnique({ where: { key } });
  if (clash) return NextResponse.json({ error: "A stage with this label already exists" }, { status: 409 });

  const last = await prisma.customPipelineStage.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const sortOrder = (last?.sortOrder ?? 0) + 1;

  const stage = await prisma.customPipelineStage.create({
    data: { key, label, color, sortOrder, retired: false },
  });

  void logAudit({
    action: "QUOTE_TEMPLATE_SETTING_UPDATED", // closest generic action; keeps this out of a per-feature enum for now
    actor: { id: user.id, email: user.email, name: user.name },
    target: { type: "QUOTE_TEMPLATE_SETTING", id: "pipeline-stages", label: `Added stage "${label}"` },
    details: { key, color },
    req,
  });

  return NextResponse.json({ ok: true, stage });
}
