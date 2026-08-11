import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

// Edit or retire a custom stage. Only fields the admin UI exposes.
export async function PATCH(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { key } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body?.label === "string" && body.label.trim()) data.label = body.label.trim();
  if (typeof body?.color === "string" && body.color.trim()) data.color = body.color.trim();
  if (typeof body?.retired === "boolean") data.retired = body.retired;
  if (typeof body?.sortOrder === "number") data.sortOrder = body.sortOrder;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.customPipelineStage.update({ where: { key }, data });

  void logAudit({
    action: "QUOTE_TEMPLATE_SETTING_UPDATED",
    actor: { id: user.id, email: user.email, name: user.name },
    target: { type: "QUOTE_TEMPLATE_SETTING", id: "pipeline-stages", label: `Updated stage "${updated.label}"` },
    details: data,
    req,
  });

  return NextResponse.json({ ok: true, stage: updated });
}

// Delete a custom stage. Refuses if any customer is currently in it —
// admins have to move them out first, or use PATCH { retired: true }.
export async function DELETE(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { key } = await ctx.params;
  const stage = await prisma.customPipelineStage.findUnique({ where: { key } });
  if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inUse = await prisma.customer.count({ where: { stage: key, deletedAt: null } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Can't delete — ${inUse} customer${inUse === 1 ? " is" : "s are"} currently in this stage. Move them first or retire the stage.` },
      { status: 409 }
    );
  }

  await prisma.customPipelineStage.delete({ where: { key } });

  void logAudit({
    action: "QUOTE_TEMPLATE_SETTING_UPDATED",
    actor: { id: user.id, email: user.email, name: user.name },
    target: { type: "QUOTE_TEMPLATE_SETTING", id: "pipeline-stages", label: `Removed stage "${stage.label}"` },
    req,
  });

  return NextResponse.json({ ok: true });
}
