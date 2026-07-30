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
import { Search, Eye, Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomersCsvPanel } from "@/components/customers/customers-csv-panel";
import { DeleteCustomerDialog } from "@/components/customers/delete-customer-dialog";
import { useCustomers, customersStore } from "@/lib/store/customers-store";
import { profileOverridesStore, useProfileOverride } from "@/lib/store/customer-profile-overrides-store";
import { getCustomerProfile } from "@/lib/mock/customer-detail";
import { customerPanelStore } from "@/lib/store/customer-panel-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser, CURRENT_USER_ID } from "@/lib/session";
import { pipelineStages, stageColorTokens } from "@/lib/constants/pipelineStages";
import type { Customer } from "@/lib/mock/pipeline";
import { Plus, Users } from "lucide-react";

function StageBadge({ stage }: { stage: Customer["stage"] }) {
  const meta = pipelineStages.find((s) => s.key === stage);
  if (!meta) return null;
  const colors = stageColorTokens[meta.color];
  return (
    <span
      className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-body font-semibold"
      style={{ backgroundColor: colors.light, color: colors.solid }}
    >
      {meta.label}
    </span>
  );
}

function NameCell({ customer }: { customer: Customer }) {
  const override = useProfileOverride(customer.id);
  return <span className="font-body text-sm text-grey-900">{override.name ?? customer.name}</span>;
}

export function CustomersTable() {
  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  const canDelete = currentUser.role === "super-admin";

  const customers = useCustomers();
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const editOverride = useProfileOverride(editTarget?.id ?? "");

  const filtered = useMemo(
    () => customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [customers, search]
  );

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      { accessorKey: "name", header: "Name", cell: ({ row }) => <NameCell customer={row.original} /> },
      { accessorKey: "address", header: "Address" },
      {
        accessorKey: "stage",
        header: "Stage",
        cell: ({ row }) => <StageBadge stage={row.original.stage} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const customer = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger
                  aria-label="View"
                  onClick={() => customerPanelStore.open(customer.id, { showActivity: false })}
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
                    onClick={() => setEditTarget(customer)}
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
                    onClick={() => setDeleteTarget(customer)}
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
    [canEdit, canDelete]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const editProfile = editTarget ? getCustomerProfile(editTarget) : undefined;

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    customersStore.deleteCustomer(deleted.id);
    setDeleteTarget(null);
    toastStore.show(`${deleted.name} deleted`, "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => customersStore.restoreCustomer(deleted.id) },
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
            placeholder="Search customers"
            className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomersCsvPanel />
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} message="No customers yet. Add one to get started." cta={{ label: "Add Customer", onClick: () => setAddOpen(true) }} />
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

      <CustomerFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) =>
          customersStore.createCustomer({
            prefix: values.prefix,
            firstName: values.firstName,
            lastName: values.lastName,
            customerCode: values.customerCode,
            mobile: values.mobile,
            email: values.email,
            gst: values.gst,
            address: values.address,
            city: values.city,
            state: values.state,
            postcode: values.postcode,
            birthdayMonth: values.birthdayMonth,
            birthdayDay: values.birthdayDay,
            birthdayYear: values.birthdayYear,
            createdById: CURRENT_USER_ID,
          })
        }
      />

      {editTarget && editProfile && (
        <CustomerFormDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          customer={editTarget}
          profile={editProfile}
          override={editOverride}
          onSubmit={(values) => {
            // Persist the identity fields (and recomposed name) to the DB…
            customersStore.updateCustomer(editTarget.id, {
              prefix: values.prefix,
              firstName: values.firstName,
              lastName: values.lastName,
              customerCode: values.customerCode,
              birthdayMonth: values.birthdayMonth,
              birthdayDay: values.birthdayDay,
              birthdayYear: values.birthdayYear,
            });
            // …and keep the local overlay in sync for the detail panel.
            profileOverridesStore.setFields(editTarget.id, {
              name: `${values.firstName} ${values.lastName}`.trim(),
              phone: values.mobile,
              email: values.email,
              gst: values.gst,
              area: values.address,
              city: values.city,
              state: values.state,
              postcode: values.postcode,
              birthdayMonth: values.birthdayMonth,
              birthdayDay: values.birthdayDay,
              updatedAt: new Date().toISOString(),
              updatedById: CURRENT_USER_ID,
            });
          }}
        />
      )}

      <DeleteCustomerDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        customer={deleteTarget}
        onConfirm={handleDelete}
      />
    </div>
  );
}
