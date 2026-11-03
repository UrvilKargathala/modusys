import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import { holidaySchema } from "@/lib/employee-schema";

export const dynamic = "force-dynamic";

// Company holidays: one row per date (a Start–End range saves every day in it, all with its description). Employees set to observe
// holidays are not scheduled on them.
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = holidaySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid holiday" }, { status: 400 });
  const { startDate, endDate, description } = parsed.data;
  const dates: Date[] = [];
  for (let d = new Date(`${startDate}T00:00:00Z`); d <= new Date(`${endDate}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) dates.push(d);
  const taken = await prisma.holiday.findMany({ where: { date: { in: dates } }, orderBy: { date: "asc" } });
  if (taken.length) {
    const list = taken.map((h) => h.date.toISOString().slice(0, 10).split("-").reverse().join("/")).join(", ");
    return NextResponse.json({ error: `Already a holiday on ${list}` }, { status: 409 });
  }
  await prisma.holiday.createMany({ data: dates.map((date) => ({ date, name: description })) });
  const label = `${startDate === endDate ? startDate : `${startDate} to ${endDate}`} ${description}`;
  void logAudit({ action: "HOLIDAY_CREATED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "PAYROLL", id: startDate, label }, req });
  return NextResponse.json({ days: dates.length }, { status: 201 });
}

export async function DELETE(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // One id, or several comma-separated (every day of one holiday range).
  const ids = (new URL(req.url).searchParams.get("id") ?? "").split(",").filter(Boolean);
  const found = await prisma.holiday.findMany({ where: { id: { in: ids } } });
  if (!found.length) return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
  await prisma.holiday.deleteMany({ where: { id: { in: found.map((h) => h.id) } } });
  void logAudit({ action: "HOLIDAY_DELETED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "PAYROLL", id: found[0].id, label: `${found[0].name} (${found.length} day${found.length === 1 ? "" : "s"})` }, req });
  return NextResponse.json({ ok: true });
}
