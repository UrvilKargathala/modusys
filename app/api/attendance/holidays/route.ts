import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import { holidaySchema } from "@/lib/employee-schema";

export const dynamic = "force-dynamic";

// Company holidays: one per date. Employees set to observe holidays are not scheduled on them.
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = holidaySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid holiday" }, { status: 400 });
  const date = new Date(`${parsed.data.date}T00:00:00Z`);
  if (await prisma.holiday.findUnique({ where: { date } })) return NextResponse.json({ error: "There is already a holiday on that date" }, { status: 409 });
  const h = await prisma.holiday.create({ data: { date, name: parsed.data.name } });
  void logAudit({ action: "HOLIDAY_CREATED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "PAYROLL", id: h.id, label: `${parsed.data.date} ${h.name}` }, req });
  return NextResponse.json(h, { status: 201 });
}

export async function DELETE(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const h = await prisma.holiday.findUnique({ where: { id } });
  if (!h) return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
  await prisma.holiday.delete({ where: { id } });
  void logAudit({ action: "HOLIDAY_DELETED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "PAYROLL", id, label: h.name }, req });
  return NextResponse.json({ ok: true });
}
