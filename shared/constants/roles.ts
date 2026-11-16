// User-confirmed 3-tier role set (replaces the earlier 4-role assumption of
// Super Admin/Admin/Sales/Manufacturing — real org roster only has these 3).
// Permission summaries are still a reasonable first pass, not backend-enforced
// yet; flag for confirmation before Phase B3 wires real RBAC.
export type RoleKey = "super-admin" | "admin" | "staff";

export type Role = {
  key: RoleKey;
  label: string;
  permissions: string[];
};

export const roles: Role[] = [
  {
    key: "super-admin",
    label: "Super Admin",
    permissions: [
      "Full access to every module",
      "Manage billing, credits, and org settings",
      "Add, remove, and change roles for any user",
    ],
  },
  {
    key: "admin",
    label: "Admin",
    permissions: [
      "Manage CRM, quotes, purchase orders, and templates",
      "Invite users and assign non-admin roles",
      "No access to billing or credits",
    ],
  },
  {
    key: "staff",
    label: "Staff",
    permissions: [
      "Create and manage day-to-day CRM, quotes, and orders",
      "No access to billing, org settings, or user management",
    ],
  },
];

export function getRole(key: RoleKey) {
  return roles.find((r) => r.key === key);
}

// For zod enum() validation, which needs a non-empty tuple, not string[].
export const roleKeys = roles.map((r) => r.key) as [RoleKey, ...RoleKey[]];
