"use client";

import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { MaterialCategory, MaterialItem } from "@shared/mock/material-spec";
import type { MaterialDependency } from "@/lib/hooks/use-material-dependencies";

export function DeleteMaterialItemDialog({
  open,
  onOpenChange,
  category,
  item,
  dependencies,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: MaterialCategory;
  item: MaterialItem | null;
  dependencies: MaterialDependency[];
  onConfirm: () => void;
}) {
  if (!item) return null;

  const totalRefs = dependencies.reduce((sum, d) => sum + d.count, 0);
  const inUse = dependencies.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {inUse ? `"${item.name}" is currently in use` : `Permanently delete "${item.name}"?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {inUse
              ? `This ${category.label.toLowerCase()} value is referenced in ${totalRefs} place${totalRefs === 1 ? "" : "s"} across the app. Deleting it may impact those records — remove or reassign every reference below before it can be deleted.`
              : `This ${category.label.toLowerCase()} value may already be referenced on existing quotes — deleting it here does not update those quotes, they'll keep showing this value as historical text, but it will no longer be selectable for new ones.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {inUse ? (
          <div className="flex flex-col gap-2 rounded-lg border border-grey-100">
            {dependencies.map((d, idx) => (
              <div
                key={`${d.module}-${d.page}`}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-sm font-body ${idx > 0 ? "border-t border-grey-100" : ""}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-grey-900">{d.module}</span>
                  <span className="text-xs text-grey-500">{d.page}</span>
                </div>
                <span className="whitespace-nowrap rounded-full bg-error-transparent px-2 py-0.5 text-xs font-medium text-error">
                  {d.count} {d.record}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-error-transparent px-3 py-2 text-sm font-body text-error">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This is permanent and cannot be undone — consider deactivating instead.
          </div>
        )}

        {inUse && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-transparent px-3 py-2 text-sm font-body text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Cannot be deleted until all dependencies above are removed.
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {!inUse && (
            <AlertDialogAction onClick={onConfirm} className="bg-error text-white hover:bg-error/90">
              Delete Permanently
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
