import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApproveRejectActions } from "@/components/leaves/approve-reject-actions";

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

export default async function AdminLeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "super-admin") redirect("/leaves");

  const { tab } = await searchParams;
  const activeTab = tab === "all" ? "all" : "pending";

  const leaves = await prisma.leaveRequest.findMany({
    where: activeTab === "pending" ? { status: "PENDING" } : undefined,
    include: { employee: { select: { name: true, department: true, employeeNumber: true } } },
    orderBy: activeTab === "pending" ? [{ appliedAt: "asc" }] : [{ appliedAt: "desc" }],
  });

  const pendingCount = await prisma.leaveRequest.count({ where: { status: "PENDING" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-grey-900">Leave Approvals</h1>
          <p className="text-sm font-body text-grey-500">Review and act on leave requests.</p>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-md border border-grey-200 p-1 self-start">
        <Link
          href="/admin/leaves"
          className={`px-3 py-1.5 text-sm font-body font-medium rounded ${activeTab === "pending" ? "bg-primary text-white" : "text-grey-600 hover:bg-grey-50"}`}
        >
          Pending Approvals
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-error px-1.5 text-[10px] text-white">{pendingCount}</span>
          )}
        </Link>
        <Link
          href="/admin/leaves?tab=all"
          className={`px-3 py-1.5 text-sm font-body font-medium rounded ${activeTab === "all" ? "bg-primary text-white" : "text-grey-600 hover:bg-grey-50"}`}
        >
          All Leaves
        </Link>
      </div>

      <Card className="overflow-hidden">
        {leaves.length === 0 ? (
          <div className="px-6 py-12 text-center font-body text-grey-400">
            {activeTab === "pending" ? "No pending leave requests." : "No leaves found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-light-600 text-left text-xs font-heading font-medium uppercase tracking-wider text-grey-500">
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">From</th>
                  <th className="px-6 py-3">To</th>
                  <th className="px-6 py-3">Days</th>
                  <th className="px-6 py-3">Reason</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-100">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-light-600/50">
                    <td className="px-6 py-3 text-sm font-body">
                      <p className="font-medium text-grey-900">{l.employee.name}</p>
                      {l.employee.department && (
                        <p className="text-xs text-grey-400">{l.employee.department}</p>
                      )}
                    </td>
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
                    </td>
                    <td className="px-6 py-3 text-right">
                      {l.status === "PENDING" ? (
                        <ApproveRejectActions id={l.id} />
                      ) : (
                        <span className="text-xs text-grey-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
