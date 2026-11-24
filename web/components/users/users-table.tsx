"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Search, Copy, KeyRound, Pencil, Trash2, UserX, UserCheck, MoreHorizontal } from "lucide-react";
import { SelectField } from "@/components/shared/select-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roles } from "@shared/constants/roles";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { RoleCell } from "@/components/users/role-cell";
import { SetPasswordDialog } from "@/components/users/set-password-dialog";
import { PasswordCell } from "@/components/users/password-cell";
import { EditUserDialog } from "@/components/users/edit-user-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getCurrentUser } from "@/lib/session";
import { usersStore } from "@/lib/store/users-store";
import { toastStore } from "@/lib/store/toast-store";
import type { OrgUser } from "@shared/mock/users";
import { cn } from "@/lib/utils";
import { useTableColumnOrder } from "@/components/shared/use-column-order";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";

function formatLastActive(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// "Today", "Yesterday", "5 days ago"; past a month the plain date reads better.
function lastActiveInfo(iso: string): { label: string; stale: boolean } {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return { label: "Today", stale: false };
  if (days === 1) return { label: "Yesterday", stale: false };
  if (days < 30) return { label: `${days} days ago`, stale: false };
  return { label: formatLastActive(iso), stale: true };
}

export type StatusFilter = "all" | "active" | "invited" | "inactive";

export function UsersTable({
  users,
  status,
  onStatusChange,
}: {
  users: OrgUser[];
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
}) {
  const [roleFilter, setRoleFilter] = useState("all");
  const canSetPassword = getCurrentUser().role === "super-admin";
  const canEditUser = getCurrentUser().role === "super-admin";
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [passwordTarget, setPasswordTarget] = useState<OrgUser | null>(null);
  const [editTarget, setEditTarget] = useState<OrgUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<OrgUser | null>(null);
  const canDeleteUser = getCurrentUser().role === "super-admin";

  // Names that appear more than once — flagged inline so an admin notices a
  // possible duplicate account without opening every row.
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) counts.set(u.name, (counts.get(u.name) ?? 0) + 1);
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [users]);

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()) &&
          (status === "all" || u.status === status) &&
          (roleFilter === "all" || u.role === roleFilter)
      ),
    [users, search, status, roleFilter]
  );

  const columns = useMemo<ColumnDef<OrgUser>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const user = row.original;
          const isDuplicate = duplicateNames.has(user.name);
          return (
            <span className="flex items-center gap-1.5">
              {user.name}
              {isDuplicate && (
                <Tooltip>
                  <TooltipTrigger className="flex items-center">
                    <Copy className="h-3.5 w-3.5 text-warning-900" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Another user shares this name — check for a duplicate account.
                  </TooltipContent>
                </Tooltip>
              )}
            </span>
          );
        },
      },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue<OrgUser["status"]>();
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-body font-medium",
                status === "active"
                  ? "bg-success-transparent text-success"
                  : status === "inactive"
                    ? "bg-error-transparent text-error"
                    : "bg-grey-transparent text-grey-600"
              )}
            >
              {status === "active" ? "Active" : status === "inactive" ? "Deactivated" : "Invited"}
            </span>
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <RoleCell user={row.original} />,
      },
      ...(canSetPassword
        ? [
            {
              id: "password",
              header: "Password",
              cell: ({ row }: { row: { original: OrgUser } }) => <PasswordCell userId={row.original.id} />,
            },
          ]
        : []),
      {
        accessorKey: "lastActive",
        header: "Last Active",
        cell: ({ getValue }) => (
          (() => {
            const iso = getValue<string>();
            const { label, stale } = lastActiveInfo(iso);
            return (
              <Tooltip>
                <TooltipTrigger className="inline-flex items-center gap-1.5 font-number text-grey-500">
                  {label}
                  {stale && (
                    <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-body font-medium text-warning-900">
                      30+ days
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {stale ? "Not seen for over 30 days. Deactivate if they've left." : formatLastActive(iso)}
                </TooltipContent>
              </Tooltip>
            );
          })()
        ),
      },
      ...(canSetPassword || canEditUser
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: OrgUser } }) => {
                const u = row.original;
                const notMe = u.id !== getCurrentUser().id;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${u.name}`}
                      className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-max min-w-48">
                      {canEditUser && (
                        <DropdownMenuItem className="gap-2" onClick={() => setEditTarget(u)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                      )}
                      {canSetPassword && (
                        <DropdownMenuItem className="gap-2" onClick={() => setPasswordTarget(u)}>
                          <KeyRound className="h-4 w-4" /> Set password
                        </DropdownMenuItem>
                      )}
                      {canDeleteUser && notMe && (
                        <>
                          <DropdownMenuItem className="gap-2" onClick={() => setStatusTarget(u)}>
                            {u.status === "inactive" ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                            {u.status === "inactive" ? "Reactivate" : "Deactivate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2 text-error" onClick={() => setDeleteTarget(u)}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              },
            } as ColumnDef<OrgUser>,
          ]
        : []),
    ],
    [duplicateNames, canSetPassword, canEditUser, canDeleteUser]
  );

  const colOrder = useTableColumnOrder("user-columns", columns.map((c) => c.id ?? (c as { accessorKey?: string }).accessorKey ?? ""));
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnOrder: colOrder.columnOrder },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const allRows = table.getRowModel().rows;
  const { page, setPage, pageCount, paged: pagedRows, totalItems, pageSize } = usePagination(allRows);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-700 outline-none placeholder:text-grey-300 focus:border-primary"
        />
      </div>
        <SelectField
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="flex h-9 min-w-36 items-center rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-700"
        >
          <option value="all">All roles</option>
          {roles.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
          <option value="no-role">No role</option>
        </SelectField>
        <SelectField
          value={status}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="flex h-9 min-w-36 items-center rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-700"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="inactive">Deactivated</option>
        </SelectField>
      </div>

      <div className="overflow-x-auto rounded-lg border border-grey-100 bg-card">
        <table className="w-full text-sm font-body">
          <thead className="bg-[var(--table-head)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-sm font-semibold uppercase tracking-wide text-grey-900">SR No</th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    {...colOrder.thProps(header.column.id)}
                    onClick={header.column.getToggleSortingHandler()}
                    className={cn("cursor-pointer whitespace-nowrap px-4 py-2.5 text-left text-sm font-semibold uppercase tracking-wide text-grey-900", colOrder.thClass(header.column.id))}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-grey-400">
                  No users match these filters.
                </td>
              </tr>
            ) : (
              pagedRows.map((row, idx) => (
                <tr key={row.id} className="border-b border-grey-100 last:border-0 hover:bg-light-600/60">
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number text-grey-500">{String(page * pageSize + idx + 1).padStart(3, "0")}</td>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-3 text-grey-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />

      <SetPasswordDialog
        open={!!passwordTarget}
        onOpenChange={(open) => !open && setPasswordTarget(null)}
        user={passwordTarget}
      />

      <EditUserDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        user={editTarget}
      />

      <AlertDialog open={!!statusTarget} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusTarget?.status === "inactive" ? "Reactivate user" : "Deactivate user"}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.status === "inactive" ? (
                <>
                  <span className="font-medium text-grey-900">{statusTarget?.name}</span> will be able to sign in again with their current password.
                </>
              ) : (
                <>
                  <span className="font-medium text-grey-900">{statusTarget?.name}</span> will be signed out everywhere and can&apos;t sign in. Their quotes, attendance and history stay. You can reactivate them any time.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!statusTarget) return;
                const next = statusTarget.status === "inactive" ? "active" : "inactive";
                usersStore.setStatus(statusTarget.id, next);
                toastStore.show(`${statusTarget.name} ${next === "inactive" ? "deactivated" : "reactivated"}`);
                setStatusTarget(null);
              }}
            >
              {statusTarget?.status === "inactive" ? "Reactivate" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-grey-900">{deleteTarget?.name}</span> ({deleteTarget?.email})? This cannot be undone. To only stop them signing in and keep their history, use Deactivate instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-white hover:bg-error/90"
              onClick={() => {
                if (!deleteTarget) return;
                usersStore.deleteUser(deleteTarget.id);
                toastStore.show(`${deleteTarget.name} deleted`, "success");
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
