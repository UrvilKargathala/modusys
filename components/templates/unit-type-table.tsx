"use client";

import { useState } from "react";
import { Plus, Pencil, Copy, Trash2, PackageSearch } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { UnitTypeFormDialog } from "@/components/templates/unit-type-form-dialog";
import { DeleteCabinetTypeDialog } from "@/components/templates/delete-cabinet-type-dialog";
import { useUnitTypes, unitTypeStore } from "@/lib/store/unit-type-store";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { UnitType } from "@/lib/mock/unit-type";

export function UnitTypeTable() {
  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  const canDelete = currentUser.role === "super-admin";

  const items = useUnitTypes();
  const cabinetTypes = useCabinetTypes();
  const cabinetTypeLabel = (links: { cabinetTypeId: string }[]) => {
    if (links.length === 0) return "—";
    const primary = cabinetTypes.find((c) => c.id === links[0].cabinetTypeId)?.name ?? "—";
    return links.length > 1 ? `${primary} +${links.length - 1}` : primary;
  };

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UnitType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnitType | null>(null);

  const handleDuplicate = (unitType: UnitType) => {
    const created = unitTypeStore.duplicateUnitType(unitType.id);
    if (created) toastStore.show(`"${created.name}" created`, "success");
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    unitTypeStore.deleteUnitType(deleted.id);
    setDeleteTarget(null);
    toastStore.show(`"${deleted.name}" deleted`, "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => unitTypeStore.restoreUnitType(deleted.id) },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-grey-900">Unit Type</h3>
          <p className="text-xs font-body text-grey-400">{items.length} unit types</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Unit Type
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          message="No unit types yet."
          cta={{ label: "Add Unit Type", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-light-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">SR No</th>
                {["Name", "Short Code", "Cabinet Type", "Components", "External Finish", "Hardware", "Other Panel", "Status"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right text-xs font-body font-medium uppercase tracking-wide text-grey-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={i.id} className="border-t border-grey-100">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-500">{String(idx + 1).padStart(3, "0")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body font-medium text-grey-900">{i.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{i.shortCode}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{cabinetTypeLabel(i.cabinetTypeLinks)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{i.components.length}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{i.externalFinishes.length}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{i.hardware.length}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">{i.otherPanels.length}</td>
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

      <UnitTypeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) => unitTypeStore.createUnitType(values)}
      />

      {editTarget && (
        <UnitTypeFormDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          item={editTarget}
          onSubmit={(values) => unitTypeStore.updateUnitType(editTarget.id, values)}
        />
      )}

      <DeleteCabinetTypeDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.name ?? null}
        entityLabel="unit type"
        onConfirm={handleDelete}
      />
    </div>
  );
}
