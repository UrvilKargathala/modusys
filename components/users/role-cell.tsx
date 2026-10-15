"use client";

import { SelectField } from "@/components/shared/select-field";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { roles, type RoleKey } from "@/lib/constants/roles";
import { usersStore } from "@/lib/store/users-store";
import { toastStore } from "@/lib/store/toast-store";
import type { OrgUser } from "@/lib/mock/users";
import { cn } from "@/lib/utils";

// Inline role change: no separate "save" step — selecting a new role in the
// table applies it immediately (same usersStore.assignRole the Assign Role
// modal uses) and confirms via toast.
// TODO: gate this to Super Admin only once real auth/session roles exist
// (Phase B3) — no fake client-side permission check without real data to
// check against.
export function RoleCell({ user }: { user: OrgUser }) {
  const isNoRole = user.role === "no-role";

  const handleChange = (e: { target: { value: string } }) => {
    const nextRole = e.target.value as RoleKey;
    usersStore.assignRole(user.id, nextRole);
    const roleLabel = roles.find((r) => r.key === nextRole)?.label ?? nextRole;
    toastStore.show(`${user.name}'s role changed to ${roleLabel}`);
  };

  return (
    <div className="relative inline-flex w-fit">
      <SelectField
        value={isNoRole ? "" : user.role}
        onChange={handleChange}
        aria-label={`Change role for ${user.name}`}
        className={cn(
          "cursor-pointer appearance-none rounded-full py-1 pl-2.5 pr-7 text-xs font-body font-medium outline-none",
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
      {isNoRole ? (
        <AlertTriangle className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-warning-900" />
      ) : (
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-primary" />
      )}
    </div>
  );
}
