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
import { Search, Eye, Pencil, Trash2, Plus, Building2, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ArchitectFormDialog } from "@/components/architects/architect-form-dialog";
import { DeleteArchitectDialog } from "@/components/architects/delete-architect-dialog";
import { useArchitects, architectsStore } from "@/lib/store/architects-store";
import { architectPanelStore } from "@/lib/store/architect-panel-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser, CURRENT_USER_ID } from "@/lib/session";
import { fullName, type Architect } from "@/lib/mock/architects";

function NameCell({ architect, isDuplicate }: { architect: Architect; isDuplicate: boolean }) {
  return (
    <span className="flex items-center gap-1.5 font-body text-sm text-grey-900">
      {fullName(architect)}
      {isDuplicate && (
        <Tooltip>
          <TooltipTrigger className="flex items-center">
            <AlertTriangle className="h-3.5 w-3.5 text-warning-900" />
          </TooltipTrigger>
          <TooltipContent>Possible duplicate entry</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

export function ArchitectsTable() {
  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  const canDelete = currentUser.role === "super-admin";

  const architects = useArchitects();
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Architect | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Architect | null>(null);

  // Flags entries sharing an identical name — enough for a Super Admin to
  // notice and manually clean up, no merge tool built (per business call).
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of architects) {
      const key = fullName(a).toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [architects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return architects.filter(
      (a) =>
        fullName(a).toLowerCase().includes(q) ||
        a.company.toLowerCase().includes(q) ||
        a.partners.some((p) => p.toLowerCase().includes(q))
    );
  }, [architects, search]);

  const columns = useMemo<ColumnDef<Architect>[]>(
    () => [
      {
        id: "name",
        accessorFn: (a) => fullName(a),
        header: "Name",
        cell: ({ row }) => (
          <NameCell architect={row.original} isDuplicate={duplicateNames.has(fullName(row.original).toLowerCase())} />
        ),
      },
      { accessorKey: "company", header: "Company" },
      {
        id: "mobile",
        accessorFn: (a) => a.mobile,
        header: "Mobile",
        cell: ({ row }) => row.original.mobile || "—",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const architect = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger
                  aria-label="View"
                  onClick={() => architectPanelStore.open(architect.id)}
                  className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                >
                  <Eye className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>View</TooltipContent>
              </Tooltip>

              {canEdit && (
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Edit"
                    onClick={() => setEditTarget(architect)}
                    className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
              )}

              {canDelete && (
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Delete"
                    onClick={() => setDeleteTarget(architect)}
                    className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [canEdit, canDelete, duplicateNames]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    architectsStore.deleteArchitect(deleted.id);
    setDeleteTarget(null);
    toastStore.show(`${fullName(deleted)} deleted`, "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => architectsStore.restoreArchitect(deleted.id) },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search architects..."
            className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Architect
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} message="No architects yet. Add one to get started." cta={{ label: "Add Architect", onClick: () => setAddOpen(true) }} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-light-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    const rendered = flexRender(header.column.columnDef.header, header.getContext());
                    return (
                      <th
                        key={header.id}
                        className="px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500"
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex items-center gap-1 uppercase tracking-wide hover:text-grey-700"
                          >
                            {rendered}
                            {sorted === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5 text-primary" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 text-grey-300" />
                            )}
                          </button>
                        ) : (
                          rendered
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-grey-100">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ArchitectFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) => architectsStore.createArchitect({ ...values, createdById: CURRENT_USER_ID })}
      />

      {editTarget && (
        <ArchitectFormDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          architect={editTarget}
          onSubmit={(values) => architectsStore.updateArchitect(editTarget.id, values)}
        />
      )}

      <DeleteArchitectDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        architect={deleteTarget}
        onConfirm={handleDelete}
      />
    </div>
  );
}
