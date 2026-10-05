"use client";

import { useMemo, useState } from "react";
import { Search, Pencil, Trash2, Plus, Store } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";
import { VendorFormDialog } from "@/components/purchase-orders/vendor-form-dialog";
import { useVendors, vendorsStore } from "@/lib/store/vendors-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser } from "@/lib/session";
import type { Vendor } from "@/lib/purchase-order";

export function VendorsTable() {
  const canDelete = getCurrentUser().role === "super-admin";
  const vendors = useVendors();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vendors.filter((v) => `${v.name} ${v.city} ${v.state} ${v.gst}`.toLowerCase().includes(q));
  }, [vendors, search]);
  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered);

  const add = async (values: Parameters<typeof vendorsStore.createVendor>[0]) => {
    try {
      await vendorsStore.createVendor(values);
      toastStore.show(`${values.name} added`, "success");
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not save vendor", "error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Store} message="No vendors yet. Add one to start creating purchase orders." cta={{ label: "Add Vendor", onClick: () => setAddOpen(true) }} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                {["Vendor", "City / State", "GST No", "Contact", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((v) => (
                <tr key={v.id} className="border-t border-grey-100">
                  <td className="px-4 py-3 text-sm font-body text-grey-900">{v.name}</td>
                  <td className="px-4 py-3 text-sm font-body text-grey-700">{[v.city, v.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{v.gst || "—"}</td>
                  <td className="px-4 py-3 text-sm font-body text-grey-700">
                    {v.contacts.length ? v.contacts.map((c) => [c.name, c.phone].filter(Boolean).join(": ")).join(" · ") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="Edit"
                          onClick={() => setEditTarget(v)}
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Delete"
                            onClick={() => setDeleteTarget(v)}
                            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
                          >
                            <Trash2 className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />

      <VendorFormDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={add} />
      {editTarget && (
        <VendorFormDialog
          open
          onOpenChange={(o) => !o && setEditTarget(null)}
          vendor={editTarget}
          onSubmit={(values) => {
            vendorsStore.updateVendor(editTarget.id, values);
            toastStore.show("Vendor updated", "success");
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "vendor"}?`}
        description="Existing purchase orders keep this vendor's name; it just disappears from the vendor list."
        onConfirm={() => {
          if (!deleteTarget) return;
          const gone = deleteTarget;
          vendorsStore.deleteVendor(gone.id);
          setDeleteTarget(null);
          toastStore.show(`${gone.name} deleted`, "success", {
            durationMs: 10000,
            action: { label: "Undo", onClick: () => vendorsStore.restoreVendor(gone.id) },
          });
        }}
      />
    </div>
  );
}
