"use client";

import { useState } from "react";
import { Plus, Pencil, Copy, Trash2, PackageSearch, Search } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CabinetTypeFormDialog } from "@/components/templates/cabinet-type-form-dialog";
import { useTableSort } from "@/components/templates/table-sort";
import { DeleteCabinetTypeDialog } from "@/components/templates/delete-cabinet-type-dialog";
import { useCabinetTypes, cabinetTypeStore } from "@/lib/store/cabinet-type-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { CabinetType } from "@/lib/mock/cabinet-type";

export function CabinetTypeTable() {
  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  const canDelete = currentUser.role === "super-admin";

  const items = useCabinetTypes();
  const brands = useMaterialItems("brand");
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? "—";

  const [search, setSearch] = useState("");
  const searched = items.filter((i) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) ||
      i.shortCode.toLowerCase().includes(q) ||
      brandName(i.brandId).toLowerCase().includes(q)
    );
  });

  const { header, sortRows } = useTableSort<"name" | "shortCode" | "brand" | "components" | "status">("name");
  const sorted = sortRows(searched, (i, key) =>
    key === "name" ? i.name
    : key === "shortCode" ? i.shortCode
    : key === "brand" ? brandName(i.brandId)
    : key === "components" ? i.components.length
    : i.active ? "Active" : "Inactive"
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CabinetType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CabinetType | null>(null);

  const handleDuplicate = (cabinetType: CabinetType) => {
    const created = cabinetTypeStore.duplicateCabinetType(cabinetType.id);
    if (created) toastStore.show(`"${created.name}" created`, "success");
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    cabinetTypeStore.deleteCabinetType(deleted.id);
    setDeleteTarget(null);
    toastStore.show(`"${deleted.name}" deleted`, "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => cabinetTypeStore.restoreCabinetType(deleted.id) },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-grey-900">Cabinet Type</h3>
          <p className="text-xs font-body text-grey-400">{items.length} cabinet types</p>
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
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Cabinet Type
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          message="No cabinet types yet."
          cta={{ label: "Add Cabinet Type", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-light-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">SR No</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">{header("name", "Name")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">{header("shortCode", "Short Code")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">{header("brand", "Brand")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">{header("components", "Components")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">{header("status", "Status")}</th>
                <th className="px-4 py-2.5 text-right text-xs font-body font-medium uppercase tracking-wide text-grey-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((i, idx) => (
                <tr key={i.id} className="border-t border-grey-100">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-500">{String(idx + 1).padStart(3, "0")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body font-medium text-grey-900">{i.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{i.shortCode}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{brandName(i.brandId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{i.components.length}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-body font-medium",
                        i.active ? "bg-success-transparent text-success" : "bg-grey-transparent text-grey-500"
                      )}
                    >
                      {i.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
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
                      {canEdit && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Copy"
                            onClick={() => handleDuplicate(i)}
                            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                          >
                            <Copy className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Duplicate</TooltipContent>
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

      <CabinetTypeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) => cabinetTypeStore.createCabinetType(values)}
      />

      {editTarget && (
        <CabinetTypeFormDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          item={editTarget}
          onSubmit={(values) => cabinetTypeStore.updateCabinetType(editTarget.id, values)}
        />
      )}

      <DeleteCabinetTypeDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.name ?? null}
        onConfirm={handleDelete}
      />
    </div>
  );
}
