"use client";

import { Suspense, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PurchaseOrdersTable } from "@/components/purchase-orders/purchase-orders-table";
import { VendorsTable } from "@/components/purchase-orders/vendors-table";
import { NewPoDialog } from "@/components/purchase-orders/new-po-dialog";

// Proforma Invoices: for now a copy of Direct Purchase Orders (same table, editor and PDFs), kept in their own list, with their own
// Dealers (the same screen as Vendors).
function View() {
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get("tab") === "dealers" ? "dealers" : "invoices";
  const [newOpen, setNewOpen] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Proforma Invoices</h1>
        <p className="text-sm font-body text-grey-500">Proforma invoices made directly, without a quote.</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => router.replace(`${pathname}?tab=${String(v)}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="invoices">Proforma Invoices</TabsTrigger>
          <TabsTrigger value="dealers">Dealers</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="pt-6">
          <PurchaseOrdersTable direct proforma onNew={() => setNewOpen(true)} />
        </TabsContent>
        <TabsContent value="dealers" className="pt-6">
          <VendorsTable dealers />
        </TabsContent>
      </Tabs>
      <NewPoDialog direct proforma open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

export function ProformaInvoicesView() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
