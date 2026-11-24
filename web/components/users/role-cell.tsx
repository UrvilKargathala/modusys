"use client";

import { SelectField } from "@/components/shared/select-field";
import { AlertTriangle } from "lucide-react";
import { roles, type RoleKey } from "@shared/constants/roles";
import { usersStore } from "@/lib/store/users-store";
import { toastStore } from "@/lib/store/toast-store";
import type { OrgUser } from "@shared/mock/users";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/session";

// Inline role change: no separate "save" step — selecting a new role in the
// table applies it immediately (same usersStore.assignRole the Assign Role
// modal uses) and confirms via toast.
// TODO: gate this to Super Admin only once real auth/session roles exist
// (Phase B3) — no fake client-side permission check without real data to
// check against.
export function RoleCell({ user }: { user: OrgUser }) {
  const isNoRole = user.role === "no-role";
  // Only a Super Admin can change roles (the server refuses anyone else), so
  // everyone else sees a plain badge instead of a dropdown that can't save.
  const canChange = getCurrentUser().role === "super-admin";

  const handleChange = (e: { target: { value: string } }) => {
    const nextRole = e.target.value as RoleKey;
    usersStore.assignRole(user.id, nextRole);
    const roleLabel = roles.find((r) => r.key === nextRole)?.label ?? nextRole;
    toastStore.show(`${user.name}'s role changed to ${roleLabel}`);
  };

  if (!canChange) {
    return (
      <span
        className={cn(
          "inline-flex rounded-full px-2.5 py-1 text-xs font-body font-medium",
          isNoRole ? "bg-warning-transparent text-warning-900" : "bg-primary-transparent text-primary"
        )}
      >
        {roles.find((r) => r.key === user.role)?.label ?? "No role"}
      </span>
    );
  }

  return (
    <div className="relative inline-flex w-fit">
      <SelectField
        value={isNoRole ? "" : user.role}
        onChange={handleChange}
        aria-label={`Change role for ${user.name}`}
        className={cn(
          "cursor-pointer appearance-none rounded-full py-1 pl-2.5 pr-2 text-xs font-body font-medium outline-none",
          isNoRole
            ? "bg-warning-transparent font-semibold text-warning-900"
            : "bg-primary-transparent text-primary"
        )}
      >
        {isNoRole && (
          <option value="" disabled>
            No role
          </option>
        )}
        {roles.map((role) => (
          <option key={role.key} value={role.key}>
            {role.label}
          </option>
        ))}
      </SelectField>
      {isNoRole && (
        <AlertTriangle className="pointer-events-none absolute right-7 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-warning-900" />
      )}
    </div>
  );
}
