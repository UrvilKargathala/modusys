"use client";

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
import { getArchitectLinkedQuotes } from "@/lib/mock/customer-detail";
import { fullName, type Architect } from "@/lib/mock/architects";

export function DeleteArchitectDialog({
  open,
  onOpenChange,
  architect,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  architect: Architect | null;
  onConfirm: () => void;
}) {
  if (!architect) return null;
  const quotes = getArchitectLinkedQuotes(architect);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {fullName(architect)}?</AlertDialogTitle>
          <AlertDialogDescription>
            {quotes.length === 0 ? (
              "This architect isn't referenced on any quotes yet."
            ) : (
              <>
                This architect is referenced on <span className="font-number">{quotes.length}</span> quote
                {quotes.length === 1 ? "" : "s"}.
              </>
            )}{" "}
            Deleting will remove this architect&apos;s record but will not delete those quotes — the
            architect field on them will show as Unassigned.
          </AlertDialogDescription>
        </AlertDialogHeader>

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
