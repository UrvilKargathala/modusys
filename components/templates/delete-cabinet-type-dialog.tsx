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

export type UsageRef = { label: string; id: string };

export function DeleteCabinetTypeDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
  entityLabel = "cabinet type",
  usedIn,
  usedInLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string | null;
  onConfirm: () => void;
  entityLabel?: string;
  usedIn?: UsageRef[];
  usedInLabel?: string;
}) {
  const refLabel = usedInLabel ?? "quote";
  if (!title) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete &ldquo;{title}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This {entityLabel} will no longer be selectable for new quotes.
            {usedIn && usedIn.length > 0
              ? " Existing quotes that reference it will keep showing it as historical text."
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {usedIn && usedIn.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg bg-warning-transparent px-3 py-2.5">
            <span className="text-sm font-body font-medium text-grey-800">
              Used in {usedIn.length} {refLabel}{usedIn.length > 1 ? "s" : ""}:
            </span>
            <ul className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {usedIn.map((ref) => (
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
