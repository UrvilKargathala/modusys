"use client";

import { useMemo, useState } from "react";
import { Search, Pencil, Trash2, Plus, Store, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";
import { VendorFormDialog } from "@/components/purchase-orders/vendor-form-dialog";
import { useDealers, useVendors, vendorsStore } from "@/lib/store/vendors-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser } from "@/lib/session";
import type { Vendor } from "@/lib/purchase-order";

// The vendor list (Purchase Orders) or, with `dealers`, the dealer list (Proforma Invoices): same table, own data.
export function VendorsTable({ dealers = false }: { dealers?: boolean }) {
  const canDelete = getCurrentUser().role === "super-admin";
  const vendorList = useVendors();
  const dealerList = useDealers();
  const vendors = dealers ? dealerList : vendorList;
  const word = dealers ? "Dealer" : "Vendor";
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vendors.filter((v) => `${v.name} ${v.code ?? ""} ${v.city} ${v.state} ${v.gst} ${(v.emails ?? []).join(" ")}`.toLowerCase().includes(q));
  }, [vendors, search]);
  // Every column but Action sorts on click: A→Z, then Z→A, then back to the saved order (numbers in order, case ignored).
  const cols: [string, (v: Vendor) => string][] = [
    [word, (v) => v.name],
    ["Code", (v) => v.code ?? ""],
    ...(dealers ? ([["Category", (v) => v.category ?? ""], ["Area", (v) => v.area ?? ""], ["Sales Person", (v) => v.salesPerson ?? ""]] as [string, (v: Vendor) => string][]) : []),
    ["City / State", (v) => [v.city, v.state].filter(Boolean).join(", ")],
    ["GST No", (v) => v.gst ?? ""],
    ["Contact", (v) => v.contacts.map((c) => [c.name, c.phone].filter(Boolean).join(": ")).join(" · ")],
    ["Email", (v) => (v.emails ?? []).join(", ")],
  ];
  const [sort, setSort] = useState<{ col: string; desc: boolean } | null>(null);
  const sorted = useMemo(() => {
    const get = sort && cols.find(([h]) => h === sort.col)?.[1];
    if (!get) return filtered;
    // Blanks always last.
    return [...filtered].sort((a, b) => {
      const x = get(a), y = get(b);
      if (!x || !y) return x ? -1 : y ? 1 : 0;
      const c = x.localeCompare(y, undefined, { sensitivity: "base", numeric: true });
      return sort.desc ? -c : c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, dealers]);
  const toggleSort = (col: string) => setSort((s) => (s?.col !== col ? { col, desc: false } : !s.desc ? { col, desc: true } : null));
  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(sorted);

  const add = async (values: Parameters<typeof vendorsStore.createVendor>[0]) => {
    try {
      await vendorsStore.createVendor(dealers ? { ...values, kind: "dealer" } : values);
      toastStore.show(`${values.name} added`, "success");
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not save vendor", "error");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${word.toLowerCase()}s...`}
            className="w-full rounded-lg border border-grey-100 bg-card py-1 pl-8 pr-3 text-xs font-body text-grey-900 outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" className="h-7 gap-1 rounded-md px-2.5 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add {word}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Store} message={dealers ? "No dealers yet. Add one to start creating proforma invoices." : "No vendors yet. Add one to start creating purchase orders."} cta={{ label: `Add ${word}`, onClick: () => setAddOpen(true) }} />
      ) : (
        <div className="overflow-x-auto [&_tr>*:first-child]:pl-2 [&_tr>*:last-child]:pr-2 [&_tbody_tr]:h-6 [&_td]:align-middle">
          <table className="w-full text-left">
            <thead className="bg-[var(--table-head)]">
              <tr>
                {cols.map(([h]) => (
                  <th key={h} className="px-2 py-1 whitespace-nowrap text-xs font-body font-semibold text-grey-900">
                    <button type="button" onClick={() => toggleSort(h)} className="flex items-center gap-1 whitespace-nowrap font-semibold text-grey-900 hover:text-grey-700">
                      {h}
                      {sort?.col !== h ? <ArrowUpDown className="h-3 w-3 text-grey-300" /> : sort.desc ? <ArrowDown className="h-3 w-3 text-primary" /> : <ArrowUp className="h-3 w-3 text-primary" />}
                    </button>
                  </th>
                ))}
                <th className="px-2 py-1 whitespace-nowrap text-xs font-body font-semibold text-grey-900">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((v) => (
                <tr key={v.id} className="hover:bg-light-600/60">
                  <td className="px-2 py-0.5 text-xs font-body text-grey-900">{v.name}</td>
                  <td className="px-2 py-0.5 font-number text-xs text-grey-700">{v.code || "—"}</td>
                  {dealers && (
                    <>
                      <td className="px-2 py-0.5 text-xs font-body text-grey-700">{v.category || "—"}</td>
                      <td className="px-2 py-0.5 text-xs font-body text-grey-700">{v.area || "—"}</td>
                      <td className="px-2 py-0.5 text-xs font-body text-grey-700">{v.salesPerson || "—"}</td>
                    </>
                  )}
                  <td className="px-2 py-0.5 text-xs font-body text-grey-700">{[v.city, v.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-2 py-0.5 font-number text-xs text-grey-700">{v.gst || "—"}</td>
                  <td className="px-2 py-0.5 text-xs font-body text-grey-700">
                    {v.contacts.length ? v.contacts.map((c) => [c.name, c.phone].filter(Boolean).join(": ")).join(" · ") : "—"}
                  </td>
                  <td className="px-2 py-0.5 text-xs font-body text-grey-700">{v.emails?.length ? v.emails.join(", ") : "—"}</td>
                  <td className="px-2 py-0.5">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="Edit"
                          onClick={() => setEditTarget(v)}
                          className="rounded-md p-0.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Delete"
                            onClick={() => setDeleteTarget(v)}
                            className="rounded-md p-0.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      <VendorFormDialog dealer={dealers} open={addOpen} onOpenChange={setAddOpen} onSubmit={add} />
      {editTarget && (
        <VendorFormDialog
          dealer={dealers}
          open
          onOpenChange={(o) => !o && setEditTarget(null)}
          vendor={editTarget}
          onSubmit={(values) => {
            vendorsStore.updateVendor(editTarget.id, values);
            toastStore.show(`${word} updated`, "success");
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? word.toLowerCase()}?`}
        description={`Existing ${dealers ? "proforma invoices" : "purchase orders"} keep this ${word.toLowerCase()}'s name; it just disappears from the ${word.toLowerCase()} list.`}
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
