"use client";

import { useState } from "react";
import { Plus, Users, UserCheck, MailQuestion, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import { UsersTable, type StatusFilter } from "@/components/users/users-table";
import { AccessModal } from "@/components/users/access-modal";
import { SecurityAuditList } from "@/components/users/security-audit-list";
import { useOrgUsers } from "@/lib/store/users-store";
import { cn } from "@/lib/utils";

export default function UsersPage() {
  const users = useOrgUsers();
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("all");

  const count = (s: StatusFilter) => (s === "all" ? users.length : users.filter((u) => u.status === s).length);
  const cards: { key: StatusFilter; label: string; icon: typeof Users; accent: "primary" | "success" | "warning" | "error" }[] = [
    { key: "all", label: "Total users", icon: Users, accent: "primary" },
    { key: "active", label: "Active", icon: UserCheck, accent: "success" },
    { key: "invited", label: "Invited (not signed in yet)", icon: MailQuestion, accent: "warning" },
    { key: "inactive", label: "Deactivated", icon: UserX, accent: "error" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-heading font-semibold text-grey-900">User Management</h1>
          <p className="text-sm font-body text-grey-400">Manage your organization&apos;s members and access levels</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Summary cards double as the status filter */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setStatus(c.key)}
            className={cn("rounded-xl text-left transition", status === c.key ? "ring-2 ring-primary" : "hover:opacity-90")}
          >
            <KpiCard compact label={c.label} value={String(count(c.key))} icon={c.icon} accent={c.accent} />
          </button>
        ))}
      </div>

      <UsersTable users={users} status={status} onStatusChange={setStatus} />

      <SecurityAuditList />

      <AccessModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
