import "server-only";
import { prisma } from "@/lib/server/prisma";

// Attendance only covers people who exist in User Management: an active
// Employee that an active User is explicitly linked to (User.employeeId) or
// shares an email with — the same two rules getCurrentEmployee() uses.
// UniFi sync imports every door user as an Employee, so without this the
// attendance views also list people who have no login.
export async function getManagedEmployeeIds(): Promise<string[]> {
  const [users, employees] = await Promise.all([
    prisma.user.findMany({ where: { status: "active" }, select: { email: true, employeeId: true } }),
    prisma.employee.findMany({ where: { isActive: true }, select: { id: true, email: true } }),
  ]);
  const linkedIds = new Set(users.map((u) => u.employeeId).filter((id): id is string => !!id));
  const emails = new Set(users.map((u) => u.email.trim().toLowerCase()));
  return employees
    .filter((e) => linkedIds.has(e.id) || (!!e.email && emails.has(e.email.trim().toLowerCase())))
    .map((e) => e.id);
}
