"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrgDetailsCard } from "@/components/users/org-details-card";
import { UsersTable } from "@/components/users/users-table";
import { AccessModal } from "@/components/users/access-modal";
import { SecurityAuditList } from "@/components/users/security-audit-list";
import { useOrgUsers } from "@/lib/store/users-store";
import { orgDetails } from "@shared/mock/users";

export default function UsersPage() {
  const users = useOrgUsers();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-heading font-semibold text-grey-900">User Management</h1>
          <p className="text-sm font-body text-grey-400">
            Manage your organization's members and access levels
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Add or manage access
        </Button>
      </div>

      <OrgDetailsCard
        name={orgDetails.name}
        type={orgDetails.type}
        creditsBalance={orgDetails.creditsBalance}
        totalMembers={users.length}
      />

      <UsersTable users={users} />

      <SecurityAuditList />

      <AccessModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
