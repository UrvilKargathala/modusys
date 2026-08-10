import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/server/prisma";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CancelLeaveButton } from "@/components/leaves/cancel-leave-button";
import { ApplyLeaveSheet } from "@/components/leaves/apply-leave-sheet";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-warning-transparent text-warning-900 border-warning/30",
  APPROVED: "bg-success-transparent text-success-900 border-success/30",
  REJECTED: "bg-error-transparent text-error border-error/30",
  CANCELLED: "bg-grey-50 text-grey-600 border-grey-200",
};

function fmt(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { user, employee } = await getCurrentEmployee();
  if (!user) redirect("/sign-in");

  const { status } = await searchParams;
  const filter = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status || "")
    ? status
    : null;

  const leaves = employee
    ? await prisma.leaveRequest.findMany({
        where: { employeeId: employee.id, ...(filter ? { status: filter } : {}) },
        orderBy: [{ appliedAt: "desc" }],
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-grey-900">My Leaves</h1>
          <p className="text-sm font-body text-grey-500">Apply for time off and track your leave history.</p>
        </div>
        <ApplyLeaveSheet />
      </div>

      {!employee && (
        <Card className="p-4">
          <p className="text-sm font-body text-grey-700">
            Your user account is not linked to an employee record yet. Ask an admin to link you.
          </p>
        </Card>
      )}

      {employee && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const).map((s) => {
              const active = (filter || "all") === s;
              const href = s === "all" ? "/leaves" : `/leaves?status=${s}`;
              return (
                <Link
                  key={s}
                  href={href}
                  className={`rounded-full px-3 py-1 text-xs font-body font-medium ${
                    active ? "bg-primary text-white" : "border border-grey-200 text-grey-600 hover:bg-grey-50"
                  }`}
                >
                  {s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                </Link>
              );
            })}
          </div>

          <Card className="overflow-hidden">
            {leaves.length === 0 ? (
              <div className="px-6 py-12 text-center font-body text-grey-400">
                No leaves found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-light-600 text-left text-xs font-heading font-medium uppercase tracking-wider text-grey-500">
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">From</th>
                      <th className="px-6 py-3">To</th>
                      <th className="px-6 py-3">Days</th>
                      <th className="px-6 py-3">Reason</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Applied</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-100">
                    {leaves.map((l) => (
                      <tr key={l.id} className="hover:bg-light-600/50">
                        <td className="px-6 py-3 text-sm font-body text-grey-800">
                          {l.leaveType === "OTHER" && l.customLeaveType
                            ? l.customLeaveType
                            : l.leaveType.charAt(0) + l.leaveType.slice(1).toLowerCase().replace("_", " ")}
                        </td>
                        <td className="px-6 py-3 text-sm font-number text-grey-700">{fmt(l.fromDate)}</td>
                        <td className="px-6 py-3 text-sm font-number text-grey-700">{fmt(l.toDate)}</td>
                        <td className="px-6 py-3 text-sm font-number text-grey-700">{l.totalDays}</td>
                        <td className="px-6 py-3 text-sm font-body text-grey-600 max-w-xs truncate" title={l.reason}>
                          {l.reason}
                        </td>
                        <td className="px-6 py-3">
                          <Badge variant="outline" className={`text-xs ${STATUS_BADGE[l.status] || ""}`}>
                            {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                          </Badge>
                          {l.reviewNote && (
                            <p className="mt-1 text-xs italic text-grey-500" title={l.reviewNote}>
                              "{l.reviewNote.length > 40 ? l.reviewNote.slice(0, 40) + "…" : l.reviewNote}"
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-3 text-sm font-number text-grey-500">
                          {fmt(l.appliedAt)}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {l.status === "PENDING" && <CancelLeaveButton id={l.id} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
