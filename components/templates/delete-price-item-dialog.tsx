"use client";

import { AlertTriangle, FileText } from "lucide-react";
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

export type PriceUsageRef = { label: string; id: string; kind: "quote" | "unit-type" };

export function DeletePriceItemDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
  usedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string | null;
  onConfirm: () => void;
  usedIn?: PriceUsageRef[];
}) {
  if (!title) return null;

  const quoteRefs = usedIn?.filter((r) => r.kind === "quote") ?? [];
  const unitTypeRefs = usedIn?.filter((r) => r.kind === "unit-type") ?? [];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete &ldquo;{title}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This pricing entry will no longer be selectable for new quotes.
            {(quoteRefs.length > 0 || unitTypeRefs.length > 0)
              ? " Existing references will keep showing it as historical text."
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {unitTypeRefs.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg bg-warning-transparent px-3 py-2.5">
            <span className="text-sm font-body font-medium text-grey-800">
              Used in {unitTypeRefs.length} unit type{unitTypeRefs.length > 1 ? "s" : ""}:
            </span>
            <ul className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {unitTypeRefs.map((ref) => (
                <li key={ref.id} className="flex items-center gap-1.5 text-sm font-body text-grey-600">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-grey-400" />
                  {ref.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {quoteRefs.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg bg-warning-transparent px-3 py-2.5">
            <span className="text-sm font-body font-medium text-grey-800">
              Used in {quoteRefs.length} quote{quoteRefs.length > 1 ? "s" : ""}:
            </span>
            <ul className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {quoteRefs.map((ref) => (
                <li key={ref.id} className="flex items-center gap-1.5 text-sm font-body text-grey-600">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-grey-400" />
                  {ref.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-error-transparent px-3 py-2 text-sm font-body text-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This is permanent and cannot be undone.
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-error text-white hover:bg-error/90">
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
