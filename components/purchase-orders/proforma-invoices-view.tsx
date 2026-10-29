"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FileText, CalendarDays, IndianRupee, Store } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/kpi-card";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useDealers } from "@/lib/store/vendors-store";
import { formatInr } from "@/lib/format";
import { poTotals } from "@/lib/purchase-order";
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
  // Work Order (/production) and Material Procurement are Production Planning; Manufacturing and Packing & Dispatch are the factory's.
  const tab = pathname.endsWith("/packing") ? "packing" : pathname.endsWith("/production") ? "production" : pathname.endsWith("/manufacturing") ? "manufacturing" : dealersTab ? "dealers" : "invoices";
  const [newOpen, setNewOpen] = useState(false);
  const invoices = usePurchaseOrders().filter((o) => !!o.material.proforma);
  const dealers = useDealers();
  const kpis = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return {
      total: invoices.length,
      thisMonth: invoices.filter((o) => o.poDate.startsWith(month)).length,
      value: invoices.reduce((s, o) => s + poTotals(o).final, 0),
    };
  }, [invoices]);
  return (
    <ProformaStatusProvider>
    <div className="-mx-2 flex flex-col gap-2 lg:-mx-4">
      <div className="px-2">
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Proforma Invoices</h1>
        <p className="text-sm font-body text-grey-500">Proforma invoices made directly, without a quote.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiCard compact label="Total Invoices" value={String(kpis.total)} icon={FileText} accent="primary" />
        <KpiCard compact label="This Month" value={String(kpis.thisMonth)} icon={CalendarDays} accent="secondary" />
        <KpiCard compact label="Total Value" value={formatInr(kpis.value)} icon={IndianRupee} accent="success" />
        <KpiCard compact label="Dealers" value={String(dealers.length)} icon={Store} accent="teal" />
      </div>

      <Tabs value={tab} onValueChange={(v) => router.replace(["packing", "production", "manufacturing"].includes(String(v)) ? `/proforma-invoices/${String(v)}` : `/proforma-invoices?tab=${String(v)}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="dealers">Dealers</TabsTrigger>
          <TabsTrigger value="invoices">Proforma Invoices</TabsTrigger>
          <TabsTrigger value="production">Work Order</TabsTrigger>
          <TabsTrigger value="manufacturing">Manufacturing</TabsTrigger>
          <TabsTrigger value="packing">Packing &amp; Dispatch</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="pt-0">
          <PurchaseOrdersTable direct proforma onNew={() => setNewOpen(true)} />
        </TabsContent>
        <TabsContent value="production" className="pt-0">
          <ProformaPackingList mode="production" />
        </TabsContent>
        <TabsContent value="manufacturing" className="pt-0">
          <ProformaPackingList mode="manufacturing" />
        </TabsContent>
        <TabsContent value="packing" className="pt-0">
          <ProformaPackingList />
        </TabsContent>
        <TabsContent value="dealers" className="pt-0">
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
