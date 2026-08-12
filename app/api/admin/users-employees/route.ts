import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

// GET returns everything the admin page needs in one payload — users with
// their current link, active employees, and a suggested match per unlinked
// user (same email OR same lowercased name).
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [users, employees] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, status: true, employeeId: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, department: true, employeeNumber: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const linkedEmployeeIds = new Set(users.map((u) => u.employeeId).filter(Boolean) as string[]);
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

  const suggestions: Record<string, string> = {};
  for (const u of users) {
    if (u.employeeId) continue;
    const emailMatch = employees.find(
      (e) => !linkedEmployeeIds.has(e.id) && e.email && norm(e.email) === norm(u.email)
    );
    if (emailMatch) {
      suggestions[u.id] = emailMatch.id;
      continue;
    }
    const nameMatch = employees.find(
      (e) => !linkedEmployeeIds.has(e.id) && norm(e.name) === norm(u.name)
    );
    if (nameMatch) suggestions[u.id] = nameMatch.id;
  }

  return NextResponse.json({ users, employees, suggestions });
}

// Manually create an Employee record for people who'll never appear via the
// UniFi Access sync (remote/non-office roles) — the only other way an
// Employee row comes into existence is app/api/unifi/sync-users.
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json();
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const email = b.email ? String(b.email).trim() : null;
  if (email) {
    const existing = await prisma.employee.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An employee with this email already exists" }, { status: 409 });
    }
  }

  const employee = await prisma.employee.create({
    data: {
      name,
      email,
      phone: b.phone ? String(b.phone).trim() : null,
      department: b.department ? String(b.department).trim() : null,
      designation: b.designation ? String(b.designation).trim() : null,
      employeeNumber: b.employeeNumber ? String(b.employeeNumber).trim() : null,
    },
  });

  void logAudit({
    action: "EMPLOYEE_CREATED",
    actor: { id: me.id, email: me.email, name: me.name },
    target: { type: "USER", id: employee.id, label: employee.name },
    req,
  });

  return NextResponse.json(employee, { status: 201 });
}
