import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { getPayrollEmployees, toPayrollEmployee } from "@/lib/server/payroll-data";
import { Card } from "@/components/ui/card";
import { EmployeeFormDialog } from "@/components/payroll/employee-form-dialog";
import { HolidaysPanel } from "@/components/payroll/payroll-actions";
import { WEEKDAYS, hoursText, scheduleOf } from "@/lib/payroll";
import { formatInr } from "@/lib/format";

export const dynamic = "force-dynamic";

const clock12 = (s: string | null) => {
  if (!s) return "—";
  const [h, m] = s.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// Employees: each person's ID, working schedule, weekly offs and hourly rate, edited by a super admin. The same records feed
// attendance, the payroll dashboard and the reports, so an employee added here shows up there at once.
export default async function EmployeesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "super-admin") redirect("/my-attendance");

  const [employees, holidays] = await Promise.all([getPayrollEmployees(), prisma.holiday.findMany({ orderBy: { date: "asc" } })]);
  const rows = employees.map((e) => ({ ...e, ...toPayrollEmployee(e) }));
  const needsSetup = rows.filter((e) => !scheduleOf(e) || (e.hourlyRate == null && e.monthlySalary == null)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-grey-900">Employees</h1>
          <p className="text-sm font-body text-grey-500">Working schedule, weekly offs and hourly rate for each employee.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/attendance/payroll" className="rounded-md border border-grey-200 bg-card px-3 py-2 text-sm text-grey-700 hover:bg-light-600">Payroll</Link>
          <EmployeeFormDialog />
        </div>
      </div>

      {needsSetup > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning bg-warning-transparent px-4 py-3 text-sm text-warning-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {needsSetup} employee{needsSetup === 1 ? " needs" : "s need"} a schedule or hourly rate before salary can be calculated.
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="bg-[var(--table-head)] text-xs font-body font-medium text-grey-900">
                {["Employee ID", "Name", "Schedule", "Required / Day", "Break", "Weekly Off", "Holidays", "Salary / Rate", "Overtime", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100 text-sm">
              {rows.map((e) => {
                const sch = scheduleOf(e);
                return (
                  <tr key={e.id} className="hover:bg-light-600/50">
                    <td className="whitespace-nowrap px-3 py-2 font-number text-grey-900">{e.employeeNumber ?? <span className="text-error">Missing</span>}</td>
                    <td className="px-3 py-2">
                      <Link href={`/attendance/reports/${e.id}`} className="text-grey-900 hover:text-primary">{e.name}</Link>
                      {(e.designation || e.department) && <div className="text-xs text-grey-500">{[e.designation, e.department].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-number">{sch ? `${clock12(e.scheduleStart)} – ${clock12(e.scheduleEnd)}` : <span className="rounded-full bg-warning-transparent px-2 py-0.5 text-xs text-warning-900">Not set</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-number">{sch ? hoursText(sch.required) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-number">{e.breakMinutes ? `${e.breakMinutes} min` : "None"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{e.weeklyOffDays.length ? e.weeklyOffDays.map((d) => WEEKDAYS[d]).join(", ") : "None"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{e.observesHolidays ? "Off" : "Working"}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-number">{e.monthlySalary != null ? `${formatInr(e.monthlySalary)} / month` : e.hourlyRate != null ? `${formatInr(e.hourlyRate)} / h` : <span className="rounded-full bg-error-transparent px-2 py-0.5 text-xs text-error">Not set</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2">{e.overtimeEnabled ? `Paid × ${e.overtimeMultiplier ?? 1}` : "Not paid"}</td>
                    <td className="px-3 py-2 text-right"><EmployeeFormDialog employee={{ ...e }} /></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-grey-500">No employees yet. Add one to start tracking attendance and salary.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h2 className="font-heading text-base font-semibold text-grey-900">Company holidays</h2>
          <p className="text-xs text-grey-500">Not scheduled working days for employees who have holidays off; never counted as absence.</p>
        </div>
        <HolidaysPanel rows={holidays.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), name: h.name }))} />
      </Card>
    </div>
  );
}
