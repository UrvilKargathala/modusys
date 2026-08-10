import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";

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
