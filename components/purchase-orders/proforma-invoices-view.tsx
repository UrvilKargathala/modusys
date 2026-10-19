"use client";

import { Suspense, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PurchaseOrdersTable } from "@/components/purchase-orders/purchase-orders-table";
import { VendorsTable } from "@/components/purchase-orders/vendors-table";
import { ProformaPackingList } from "@/components/purchase-orders/proforma-packing-list";
import { ProformaStatusProvider } from "@/components/purchase-orders/proforma-status-change";
import { NewPoDialog } from "@/components/purchase-orders/new-po-dialog";

// Proforma Invoices: for now a copy of Direct Purchase Orders (same table, editor and PDFs), kept in their own list, with their own
// Dealers (the same screen as Vendors).
function View() {
  const router = useRouter();
  const pathname = usePathname();
  const dealersTab = useSearchParams().get("tab") === "dealers";
  const tab = pathname.endsWith("/packing") ? "packing" : pathname.endsWith("/production") ? "production" : dealersTab ? "dealers" : "invoices";
  const [newOpen, setNewOpen] = useState(false);
  return (
    <ProformaStatusProvider>
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Proforma Invoices</h1>
        <p className="text-sm font-body text-grey-500">Proforma invoices made directly, without a quote.</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => router.replace(String(v) === "packing" ? "/proforma-invoices/packing" : String(v) === "production" ? "/proforma-invoices/production" : `/proforma-invoices?tab=${String(v)}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="dealers">Dealers</TabsTrigger>
          <TabsTrigger value="invoices">Proforma Invoices</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="packing">Packing</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="pt-6">
          <PurchaseOrdersTable direct proforma onNew={() => setNewOpen(true)} />
        </TabsContent>
        <TabsContent value="production" className="pt-6">
          <ProformaPackingList mode="production" />
        </TabsContent>
        <TabsContent value="packing" className="pt-6">
          <ProformaPackingList />
        </TabsContent>
        <TabsContent value="dealers" className="pt-6">
          <VendorsTable dealers />
        </TabsContent>
      </Tabs>
      <NewPoDialog direct proforma open={newOpen} onOpenChange={setNewOpen} />
    </div>
    </ProformaStatusProvider>
  );
}

export function ProformaInvoicesView() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
