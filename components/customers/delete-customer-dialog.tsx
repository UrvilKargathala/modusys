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
import { getCustomerQuotes } from "@/lib/mock/customer-detail";
import type { Customer } from "@/lib/mock/pipeline";

const ACTIVE_STAGES = new Set(["production", "material-requirement-slip", "ready-to-dispatch", "installation"]);

export function DeleteCustomerDialog({
  open,
  onOpenChange,
  customer,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onConfirm: () => void;
}) {
  if (!customer) return null;
  const quotes = getCustomerQuotes(customer);
  const hasActiveOrder = ACTIVE_STAGES.has(customer.stage);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {customer.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the customer from your active list. It has{" "}
            <span className="font-number">{quotes.length}</span> linked quote
            {quotes.length === 1 ? "" : "s"}, uploaded files, and activity history — these are kept
            on record, not deleted, but will no longer be linked to an active customer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasActiveOrder && (
          <div className="flex items-start gap-2 rounded-lg bg-error-transparent px-3 py-2 text-sm font-body text-error">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This customer has an active order in progress — deleting is not recommended.
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-error text-white hover:bg-error/90"
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
