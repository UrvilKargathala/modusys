import "server-only";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser, type SessionUser } from "@/lib/server/require-user";

// Users authenticate; Employees own AttendanceRecords. There is no explicit
// user→employee foreign key, so we match on email (both columns are @unique).
// ponytail: email join, add a userId FK on Employee if names/emails ever drift.
export async function getCurrentEmployee(): Promise<
  | { user: SessionUser; employee: { id: string; name: string } }
  | { user: SessionUser; employee: null }
  | { user: null; employee: null }
> {
  const user = await getSessionUser();
  if (!user) return { user: null, employee: null };
  const employee = await prisma.employee.findFirst({
    where: { email: user.email, isActive: true },
    select: { id: true, name: true },
  });
  return { user, employee };
}
