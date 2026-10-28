import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";
import { employeeData, employeeSchema } from "@/lib/employee-schema";

export const dynamic = "force-dynamic";

// PATCH: a super admin edits an employee's details, schedule or rate. Finalized payroll months keep their frozen rate.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!(await prisma.employee.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const parsed = employeeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid employee", issues: parsed.error.issues }, { status: 400 });
  const data = employeeData(parsed.data);
  if (await prisma.employee.findFirst({ where: { employeeNumber: data.employeeNumber, NOT: { id } } }))
    return NextResponse.json({ error: `Employee ID ${data.employeeNumber} is already used` }, { status: 409 });
  if (data.email && (await prisma.employee.findFirst({ where: { email: data.email, NOT: { id } } })))
    return NextResponse.json({ error: "An employee with this email already exists" }, { status: 409 });

  const employee = await prisma.employee.update({ where: { id }, data, select: { id: true, name: true } });
  void logAudit({ action: "EMPLOYEE_UPDATED", actor: { id: me.id, email: me.email, name: me.name }, target: { type: "EMPLOYEE", id, label: employee.name }, req });
  return NextResponse.json(employee);
}
