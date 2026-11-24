import type { RoleKey } from "../constants/roles";

export type UserStatus = "active" | "invited" | "inactive";

export type OrgUser = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  role: RoleKey | "no-role";
  // TODO: no real "last active" tracking yet — backend needs to log this per
  // session (Phase B3). Mocked here so the column isn't left blank.
  lastActive: string; // ISO date
  mustChangePassword?: boolean;
  passwordUpdatedAt?: string; // ISO date
};

export const orgDetails = {
  name: "The Furn Enterprise",
  type: "Retailer" as const,
  creditsBalance: 12500,
};

// Real org roster provided by the user. Emails are placeholders (not
// supplied) pending real data integration — see the "real data integration
// plan" memory for how this file gets replaced by a live API call.
export const mockUsers: OrgUser[] = [
  { id: "u1", name: "Chirag Patel", email: "chirag.patel@modusys.in", status: "active", role: "super-admin", lastActive: "2026-07-18T09:12:00Z" },
  { id: "u2", name: "Henil Patel", email: "henil.patel@modusys.in", status: "active", role: "super-admin", lastActive: "2026-07-17T14:30:00Z" },
  { id: "u3", name: "Soham Patel", email: "soham.patel@modusys.in", status: "active", role: "super-admin", lastActive: "2026-07-18T08:05:00Z" },
  { id: "u4", name: "Vipul Bhai", email: "vipul.bhai@modusys.in", status: "active", role: "super-admin", lastActive: "2026-07-16T11:45:00Z" },
  { id: "u5", name: "Preeti Madam", email: "preeti.madam@modusys.in", status: "active", role: "admin", lastActive: "2026-07-18T07:50:00Z" },
  { id: "u6", name: "Vijay Bhaskar", email: "vijay.bhaskar@modusys.in", status: "active", role: "staff", lastActive: "2026-07-14T10:10:00Z" },
  { id: "u7", name: "Devangee Sailor", email: "devangee.sailor@modusys.in", status: "active", role: "staff", lastActive: "2026-07-17T12:00:00Z" },
  { id: "u8", name: "Brijesh Mendapara", email: "brijesh.mendapara@modusys.in", status: "active", role: "staff", lastActive: "2026-07-13T09:30:00Z" },
  { id: "u9", name: "Mihir Patel", email: "mihir.patel@modusys.in", status: "active", role: "staff", lastActive: "2026-07-15T16:15:00Z" },
];

export function getUsers(): OrgUser[] {
  return mockUsers;
}

export function getTotalMembers() {
  return mockUsers.length;
}
