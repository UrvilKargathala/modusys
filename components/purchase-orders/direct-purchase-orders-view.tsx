"use client";

import { useState } from "react";
import { PurchaseOrdersTable } from "@/components/purchase-orders/purchase-orders-table";
import { NewPoDialog } from "@/components/purchase-orders/new-po-dialog";

// Direct Purchase Orders: POs made by hand, not from a quote. Same table and editor as Purchase Orders, kept in their own list.
export function DirectPurchaseOrdersView() {
  const [newOpen, setNewOpen] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Direct Purchase Orders</h1>
        <p className="text-sm font-body text-grey-500">Purchase orders made directly, without a quote.</p>
      </div>
      <PurchaseOrdersTable direct onNew={() => setNewOpen(true)} />
      <NewPoDialog direct open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
