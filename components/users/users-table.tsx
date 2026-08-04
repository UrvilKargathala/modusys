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
import { Search, Copy, KeyRound, Pencil } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { RoleCell } from "@/components/users/role-cell";
import { SetPasswordDialog } from "@/components/users/set-password-dialog";
import { EditUserDialog } from "@/components/users/edit-user-dialog";
import { getCurrentUser } from "@/lib/session";
import type { OrgUser } from "@/lib/mock/users";
import { cn } from "@/lib/utils";

function formatLastActive(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function UsersTable({ users }: { users: OrgUser[] }) {
  const canSetPassword = getCurrentUser().role === "super-admin";
  const canEditUser = getCurrentUser().role === "super-admin";
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [passwordTarget, setPasswordTarget] = useState<OrgUser | null>(null);
  const [editTarget, setEditTarget] = useState<OrgUser | null>(null);

  // Names that appear more than once — flagged inline so an admin notices a
  // possible duplicate account without opening every row.
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) counts.set(u.name, (counts.get(u.name) ?? 0) + 1);
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [users]);

  const filtered = useMemo(
    () =>
      users.filter((u) =>
        `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
      ),
    [users, search]
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
                status === "active" ? "bg-success-transparent text-success" : "bg-grey-transparent text-grey-600"
              )}
            >
              {status === "active" ? "Active" : "Invited"}
            </span>
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <RoleCell user={row.original} />,
      },
      {
        accessorKey: "lastActive",
        header: "Last Active",
        cell: ({ getValue }) => (
          <span className="font-number text-grey-500">{formatLastActive(getValue<string>())}</span>
        ),
      },
      ...(canSetPassword || canEditUser
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: OrgUser } }) => (
                <div className="flex items-center gap-1">
                  {canEditUser && (
                    <Tooltip>
                      <TooltipTrigger
                        aria-label="Edit"
                        onClick={() => setEditTarget(row.original)}
                        className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                  )}
                  {canSetPassword && (
                    <Tooltip>
                      <TooltipTrigger
                        aria-label="Set Password"
                        onClick={() => setPasswordTarget(row.original)}
                        className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                      >
                        <KeyRound className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>Set Password</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              ),
            } as ColumnDef<OrgUser>,
          ]
        : []),
    ],
    [duplicateNames, canSetPassword, canEditUser]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-700 outline-none placeholder:text-grey-300 focus:border-primary"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-grey-100 bg-card">
        <table className="w-full text-sm font-body">
          <thead className="bg-[#DACCCC]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none whitespace-nowrap px-4 py-2.5 text-left text-sm font-semibold uppercase tracking-wide text-grey-900"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-grey-400">
                  No users match your search.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-grey-100 last:border-0 hover:bg-light-600/60">
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
    </div>
  );
}
