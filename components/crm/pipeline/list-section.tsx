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
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortMenu } from "@/components/crm/pipeline/sort-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { sortCustomers, type Customer, type CustomerSortOption } from "@/lib/mock/pipeline";
import { stageColorTokens, type PipelineStage } from "@/lib/constants/pipelineStages";
import { customerPanelStore } from "@/lib/store/customer-panel-store";

const columns: ColumnDef<Customer>[] = [
  { accessorKey: "name", header: "Client Name" },
  { accessorKey: "address", header: "Address" },
  {
    accessorKey: "finalOfferLakh",
    header: "Final Offer",
    cell: ({ getValue }) => {
      const value = getValue<number | null>();
      return value === null ? (
        <span className="text-grey-300">—</span>
      ) : (
        <span className="font-number font-medium text-grey-800">₹{value.toFixed(1)}L</span>
      );
    },
  },
  {
    accessorKey: "lastActivity",
    header: "Last Activity",
    cell: ({ getValue }) => (
      <span className="font-number">{new Date(getValue<string>()).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
    ),
  },
  { accessorKey: "assignee", header: "Assignee" },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          customerPanelStore.open(row.original.id);
        }}
        aria-label="View customer"
        className="rounded p-1 text-grey-300 transition-colors hover:bg-light-600 hover:text-grey-600"
      >
        <Eye className="h-4 w-4" />
      </button>
    ),
  },
];

export function ListSection({
  stage,
  customers,
  expanded,
  onToggle,
  muted,
}: {
  stage: PipelineStage;
  customers: Customer[];
  expanded: boolean;
  onToggle: () => void;
  muted?: boolean;
}) {
  const [sort, setSort] = useState<CustomerSortOption>("last-activity");
  const [sorting, setSorting] = useState<SortingState>([]);

  const filtered = useMemo(() => sortCustomers(customers, sort), [customers, sort]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const colors = stageColorTokens[stage.color];

  return (
    <div className="rounded-lg border border-grey-100 bg-card">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-grey-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-grey-400" />
          )}
          <span
            className={cn(
              "inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-body font-semibold uppercase tracking-wide",
              muted ? "text-grey-400" : "text-grey-800"
            )}
            style={{ backgroundColor: colors.light }}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: colors.solid }} />
            <span className="truncate">{stage.label} · {customers.length}</span>
          </span>
        </button>

        {expanded && (
          <div className="flex shrink-0 items-center gap-2">
            <SortMenu value={sort} onChange={setSort} />
            <button
              type="button"
              aria-label={`Add customer to ${stage.label}`}
              className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Stage actions"
                className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-grey-700"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem className="px-2.5 py-2 text-sm">Bulk reassign</DropdownMenuItem>
                <DropdownMenuItem className="px-2.5 py-2 text-sm">Bulk move stage</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-grey-100">
          {customers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm font-body text-grey-400">
              No customers in this stage.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-grey-100">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className="cursor-pointer select-none whitespace-nowrap px-4 py-2 text-left text-xs font-medium text-grey-400"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => customerPanelStore.open(row.original.id)}
                      className="cursor-pointer border-b border-grey-100 last:border-0 hover:bg-light-600/60"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="whitespace-nowrap px-4 py-2.5 text-grey-700">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-body text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add customer to this stage
          </button>
        </div>
      )}
    </div>
  );
}
