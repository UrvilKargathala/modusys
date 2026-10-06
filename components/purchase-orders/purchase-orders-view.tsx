"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ShoppingCart, CalendarDays, IndianRupee, Store } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/kpi-card";
import { PurchaseOrdersTable } from "@/components/purchase-orders/purchase-orders-table";
import { VendorsTable } from "@/components/purchase-orders/vendors-table";
import { NewPoDialog } from "@/components/purchase-orders/new-po-dialog";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useVendors } from "@/lib/store/vendors-store";
import { formatInr } from "@/lib/format";
import { poTotals } from "@/lib/purchase-order";

const tabs = [
  { value: "orders", label: "Purchase Orders" },
  { value: "vendors", label: "Vendors" },
];

function View() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "vendors" ? "vendors" : "orders";
  const quoteFilter = searchParams.get("quote");

  const [newOpen, setNewOpen] = useState(false);
  const orders = usePurchaseOrders();
  const vendors = useVendors();
  const kpis = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return {
      total: orders.length,
      thisMonth: orders.filter((o) => o.poDate.startsWith(month)).length,
      value: orders.reduce((s, o) => s + poTotals(o).final, 0),
    };
  }, [orders]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Purchase Orders</h1>
        <p className="text-sm font-body text-grey-500">Orders sent to vendors for manufacturing and supply.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total POs" value={String(kpis.total)} icon={ShoppingCart} accent="primary" />
        <KpiCard label="This Month" value={String(kpis.thisMonth)} icon={CalendarDays} accent="secondary" />
        <KpiCard label="Total Value" value={formatInr(kpis.value)} icon={IndianRupee} accent="success" />
        <KpiCard label="Vendors" value={String(vendors.length)} icon={Store} accent="teal" />
      </div>

      <Tabs value={tab} onValueChange={(v) => router.replace(`${pathname}?tab=${String(v)}`, { scroll: false })}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="orders" className="pt-6">
          <PurchaseOrdersTable onNew={() => setNewOpen(true)} quoteId={quoteFilter} onClearQuote={() => router.replace(pathname, { scroll: false })} />
        </TabsContent>
        <TabsContent value="vendors" className="pt-6">
          <VendorsTable />
        </TabsContent>
      </Tabs>
      <NewPoDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

export function PurchaseOrdersView() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
