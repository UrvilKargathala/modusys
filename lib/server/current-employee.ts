import "server-only";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser, type SessionUser } from "@/lib/server/require-user";

// Users authenticate; Employees own AttendanceRecords. Two ways to resolve:
//   1. Explicit link — User.employeeId (set via /admin/users-employees).
//   2. Fallback — email match (User.email == Employee.email).
// The explicit link wins so admins can override incorrect email matches or
// link a user whose Employee row uses a personal email.
export async function getCurrentEmployee(): Promise<
  | { user: SessionUser; employee: { id: string; name: string } }
  | { user: SessionUser; employee: null }
  | { user: null; employee: null }
> {
  const user = await getSessionUser();
  if (!user) return { user: null, employee: null };
  // Explicit link first — read straight from the User row.
  const userRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: { employeeId: true },
  });
  if (userRow?.employeeId) {
    const linked = await prisma.employee.findFirst({
      where: { id: userRow.employeeId, isActive: true },
      select: { id: true, name: true },
    });
    if (linked) return { user, employee: linked };
  }
  // Fallback: email match.
  const byEmail = await prisma.employee.findFirst({
    where: { email: user.email, isActive: true },
    select: { id: true, name: true },
  });
  return { user, employee: byEmail };
}
