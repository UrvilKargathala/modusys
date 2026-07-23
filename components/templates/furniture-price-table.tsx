"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Copy, PackageSearch } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { FurniturePriceFormDialog } from "@/components/templates/furniture-price-form-dialog";
import { DeletePriceItemDialog } from "@/components/templates/delete-price-item-dialog";
import { useFurniturePriceItems, pricingListStore } from "@/lib/store/pricing-list-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser } from "@/lib/session";
import type { FurniturePriceItem } from "@/lib/mock/pricing-list";

const dimensionKeys = ["thicknessId", "rawMaterialTypeId", "internalColourId", "externalColourId"] as const;

export function FurniturePriceTable() {
  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  const canDelete = currentUser.role === "super-admin";

  const items = useFurniturePriceItems();
  // Read names live from the store (not the static seed array) so renames
  // in Material Spec show up here immediately instead of requiring a reload.
  const thicknesses = useMaterialItems("thickness");
  const rawMaterialTypes = useMaterialItems("raw-material-type");
  const internalColours = useMaterialItems("internal-colour");
  const externalColours = useMaterialItems("external-colour");
  const materialName = (id: string) =>
    [...thicknesses, ...rawMaterialTypes, ...internalColours, ...externalColours].find((m) => m.id === id)?.name ?? "—";
  const [filterDimension, setFilterDimension] = useState<(typeof dimensionKeys)[number] | "all">("all");
  const [filterValue, setFilterValue] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FurniturePriceItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FurniturePriceItem | null>(null);

  const filterOptions = useMemo(() => {
    if (filterDimension === "all") return [];
    const ids = new Set(items.map((i) => i[filterDimension]));
    return [...ids].map((id) => ({ id, name: materialName(id) }));
  }, [items, filterDimension]);

  const filtered = useMemo(() => {
    if (filterDimension === "all" || !filterValue) return items;
    return items.filter((i) => i[filterDimension] === filterValue);
  }, [items, filterDimension, filterValue]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    pricingListStore.deleteFurnitureItem(deleted.id);
    setDeleteTarget(null);
    toastStore.show("Furniture price entry deleted", "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => pricingListStore.restoreFurnitureItem(deleted.id) },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-grey-900">Furniture Price List</h3>
          <p className="text-xs font-body text-grey-400">{items.length} combinations priced</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterDimension}
            onChange={(e) => {
              setFilterDimension(e.target.value as typeof filterDimension);
              setFilterValue("");
            }}
            className="rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
          >
            <option value="all">Filter by...</option>
            <option value="thicknessId">Thickness</option>
            <option value="rawMaterialTypeId">Raw Material Type</option>
            <option value="internalColourId">Internal Colour</option>
            <option value="externalColourId">External Colour</option>
          </select>
          {filterDimension !== "all" && (
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
            >
              <option value="">All values</option>
              {filterOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Price
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          message={items.length === 0 ? "No furniture pricing entries yet." : "No entries match this filter."}
          cta={items.length === 0 ? { label: "Add Price", onClick: () => setAddOpen(true) } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-light-600">
              <tr>
                {["Thickness", "Raw Material Type", "Internal Colours and Description", "External Colours and Description", "Rate/sq.ft"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right text-xs font-body font-medium uppercase tracking-wide text-grey-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-t border-grey-100">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body font-medium text-grey-900">{materialName(i.thicknessId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-900">{materialName(i.rawMaterialTypeId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{materialName(i.internalColourId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{materialName(i.externalColourId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body font-semibold text-grey-900">{i.rate.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Duplicate"
                            onClick={() => {
                              const { id: _id, createdAt: _c, deleted: _d, ...rest } = i;
                              pricingListStore.createFurnitureItem(rest);
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

      <FurniturePriceFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) => pricingListStore.createFurnitureItem(values)}
        onEditExisting={(existing) => setEditTarget(existing)}
      />

      {editTarget && (
        <FurniturePriceFormDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          item={editTarget}
          onSubmit={(values) => pricingListStore.updateFurnitureItem(editTarget.id, values)}
          onEditExisting={(existing) => setEditTarget(existing)}
        />
      )}

      <DeletePriceItemDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `${materialName(deleteTarget.thicknessId)} ${materialName(deleteTarget.rawMaterialTypeId)}` : null}
        onConfirm={handleDelete}
      />
    </div>
  );
}
