import { NextResponse } from "next/server";
import { prisma } from "@backend/server/prisma";
import { requireRole } from "@backend/server/require-user";
import { getPayrollEmployees, toPayrollEmployee } from "@backend/server/payroll-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mobile/attendance/employees → the website's Employees page (super admin): every managed employee with their
// details, schedule and pay settings (numbers as numbers), and the company holidays. Changes go through the website's own
// routes (POST /api/attendance/employees, PATCH /api/attendance/employees/:id, POST/DELETE /api/attendance/holidays).
export async function GET() {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;
  const [employees, holidays] = await Promise.all([getPayrollEmployees(), prisma.holiday.findMany({ orderBy: { date: "asc" } })]);
  return NextResponse.json({
    employees: employees.map((e) => {
      const pe = toPayrollEmployee(e);
      return {
        id: e.id, name: e.name, employeeNumber: e.employeeNumber, department: e.department, designation: e.designation,
        email: e.email, phone: e.phone, scheduleStart: e.scheduleStart, scheduleEnd: e.scheduleEnd,
        requiredDailyMinutes: e.requiredDailyMinutes, breakMinutes: e.breakMinutes, lateGraceMinutes: e.lateGraceMinutes,
        // The days actually used (no schedule yet = Saturday and Sunday off, as Payroll assumes) and what is saved.
        weeklyOffDays: pe.weeklyOffDays, savedWeeklyOffDays: e.weeklyOffDays, observesHolidays: e.observesHolidays,
        hourlyRate: pe.hourlyRate, monthlySalary: pe.monthlySalary, overtimeEnabled: e.overtimeEnabled, overtimeMultiplier: pe.overtimeMultiplier,
      };
    }),
    holidays: holidays.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), name: h.name })),
  });
}
