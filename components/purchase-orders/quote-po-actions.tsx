"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreatePoDialog } from "@/components/purchase-orders/create-po-dialog";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { getCurrentUser } from "@/lib/session";

// Purchase-order actions for one saved quote (edit/view screen): create a PO
// from it, and jump to the POs already made from it. The PO copies the quote
// as last saved, so unsaved edits on the screen are not included.
export function QuotePoActions({ quoteId }: { quoteId: string }) {
  const role = getCurrentUser().role;
  const quote = useQuotes().find((q) => q.id === quoteId) ?? null;
  const count = usePurchaseOrders().filter((p) => p.quoteId === quoteId).length;
  const [open, setOpen] = useState(false);

  if (role !== "super-admin" && role !== "admin") return null;

  return (
    <>
      {count > 0 && (
        <Link
          href={`/purchase-orders?quote=${quoteId}`}
          className="inline-flex h-8 items-center rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-700 hover:bg-light-600"
        >
          Purchase Orders (<span className="font-number">{count}</span>)
        </Link>
      )}
      <Button type="button" variant="outline" disabled={!quote} onClick={() => setOpen(true)}>
        <ShoppingCart className="h-4 w-4" />
        Create Purchase Order
      </Button>
      <CreatePoDialog quote={open ? quote : null} onOpenChange={(o) => !o && setOpen(false)} />
    </>
  );
}
