"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Copy, PackageSearch, Search } from "lucide-react";
import { useTableSort } from "@/components/templates/table-sort";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PurchaseFurniturePriceFormDialog } from "@/components/templates/purchase-furniture-price-form-dialog";
import { DeletePriceItemDialog } from "@/components/templates/delete-price-item-dialog";
import { usePurchaseFurniturePriceItems, purchaseFurnitureStore } from "@/lib/store/purchase-furniture-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { useVendors } from "@/lib/store/vendors-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser } from "@/lib/session";
import type { PurchaseFurniturePriceItem } from "@/lib/mock/pricing-list";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";

const th = "whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900";

export function PurchaseFurniturePriceTable() {
  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  const canDelete = currentUser.role === "super-admin";

  const items = usePurchaseFurniturePriceItems();
  // Names are read live from the stores so renames show up without a reload.
  const thicknesses = useMaterialItems("thickness");
  const rawMaterialTypes = useMaterialItems("raw-material-type");
  const internals = useMaterialItems("purchase-internal");
  const vendors = useVendors();
  const externals = useMaterialItems("purchase-external");
  const nameOf = (list: { id: string; name: string }[], id: string) => list.find((m) => m.id === id)?.name ?? "—";
  // "Brand — Colour code" for the purchase finishes.
  const brandCodeOf = (list: { id: string; name: string; description: string }[], id: string) => {
    const m = list.find((x) => x.id === id);
    return m ? `${m.description} — ${m.name}` : "—";
  };

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PurchaseFurniturePriceItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseFurniturePriceItem | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.variantId.toLowerCase().includes(q) ||
        [nameOf(thicknesses, i.thicknessId), nameOf(rawMaterialTypes, i.rawMaterialTypeId), brandCodeOf(internals, i.internalColourId), brandCodeOf(externals, i.externalColourId)].some((t) =>
          t.toLowerCase().includes(q)
        )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, thicknesses, rawMaterialTypes, internals, externals]);

  const { header, sortRows } = useTableSort<"variantId" | "thickness" | "rawMaterial" | "internal" | "external" | "rate">("thickness");
  const sorted = sortRows(filtered, (i, key) =>
    key === "variantId" ? i.variantId
    : key === "thickness" ? nameOf(thicknesses, i.thicknessId)
    : key === "rawMaterial" ? nameOf(rawMaterialTypes, i.rawMaterialTypeId)
    : key === "internal" ? brandCodeOf(internals, i.internalColourId)
    : key === "external" ? brandCodeOf(externals, i.externalColourId)
    : i.rate
  );
  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(sorted);

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    purchaseFurnitureStore.remove(deleted.id);
    setDeleteTarget(null);
    toastStore.show("Purchase furniture price entry deleted", "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => purchaseFurnitureStore.restore(deleted.id) },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-grey-900">Purchase Furniture Price List</h3>
          <p className="text-xs font-body text-grey-400"><span className="font-number">{items.length}</span> combinations priced</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-44">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-lg border border-grey-100 bg-card py-1.5 pl-8 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
            />
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Price
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          message={items.length === 0 ? "No purchase furniture pricing entries yet." : "No entries match your search."}
          cta={items.length === 0 && canEdit ? { label: "Add Price", onClick: () => setAddOpen(true) } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                <th className={th}>SR No</th>
                <th className={th}>{header("variantId", "Variant ID")}</th>
                <th className={th}>Vendor Name</th>
                <th className={th}>{header("thickness", "Thickness")}</th>
                <th className={th}>{header("rawMaterial", "Raw Material Type")}</th>
                <th className={th}>{header("internal", "Internal Brand and Colour")}</th>
                <th className={th}>{header("external", "External Brand and Colour")}</th>
                <th className={th}>{header("rate", "Rate/sq.ft")}</th>
                <th className="px-4 py-2.5 text-right text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((i, idx) => (
                <tr key={i.id} className="border-t border-grey-100">
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number text-grey-500">{String(page * pageSize + idx + 1).padStart(3, "0")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number font-medium text-grey-900">{i.variantId || <span className="text-grey-300">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body text-grey-900">{vendors.find((v) => v.id === i.vendorId)?.name || <span className="text-grey-400">Any vendor</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body font-medium text-grey-900">{nameOf(thicknesses, i.thicknessId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body text-grey-900">{nameOf(rawMaterialTypes, i.rawMaterialTypeId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body text-grey-700">{brandCodeOf(internals, i.internalColourId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body text-grey-700">{brandCodeOf(externals, i.externalColourId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number font-semibold text-grey-900">{i.rate.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Duplicate"
                            onClick={() => {
                              const { id: _id, createdAt: _c, deleted: _d, ...rest } = i;
                              purchaseFurnitureStore.create(rest);
                              toastStore.show("Price entry duplicated", "success");
                            }}
                            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                          >
                            <Copy className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Duplicate</TooltipContent>
                        </Tooltip>
                      )}
                      {canEdit && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Edit"
                            onClick={() => setEditTarget(i)}
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
                            onClick={() => setDeleteTarget(i)}
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

      <PurchaseFurniturePriceFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) => purchaseFurnitureStore.create(values)}
        onEditExisting={(existing) => setEditTarget(existing)}
      />

      {editTarget && (
        <PurchaseFurniturePriceFormDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          item={editTarget}
          onSubmit={(values) => purchaseFurnitureStore.update(editTarget.id, values)}
          onEditExisting={(existing) => setEditTarget(existing)}
        />
      )}

      <DeletePriceItemDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `${nameOf(thicknesses, deleteTarget.thicknessId)} ${nameOf(rawMaterialTypes, deleteTarget.rawMaterialTypeId)}` : null}
        onConfirm={handleDelete}
      />
    </div>
  );
}
