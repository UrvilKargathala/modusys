"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ShoppingCart, CalendarDays, IndianRupee, Store } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { KpiCard } from "@/components/shared/kpi-card";
import { PurchaseOrdersTable } from "@/components/purchase-orders/purchase-orders-table";
import { NewPoDialog } from "@/components/purchase-orders/new-po-dialog";
import { CreateFromProcurementDialog } from "@/components/purchase-orders/create-from-procurement-dialog";
import { CreatePoDialog } from "@/components/purchase-orders/create-po-dialog";
import type { Quote } from "@/lib/mock/quote";
import { VendorsTable } from "@/components/purchase-orders/vendors-table";
import { ProformaPackingList } from "@/components/purchase-orders/proforma-packing-list";
import { ProformaStatusProvider } from "@/components/purchase-orders/proforma-status-change";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useVendors } from "@/lib/store/vendors-store";
import { formatInr } from "@/lib/format";
import { poTotals } from "@/lib/purchase-order";

// One page for Purchase Orders and Direct Purchase Orders: All lists both kinds (with a Type column).
const tabs = [
  { value: "all", label: "All" },
  { value: "po", label: "Purchase Orders" },
  { value: "production", label: "Production" },
  { value: "packing", label: "Packing" },
  { value: "vendors", label: "Vendors" },
] as const;
type TabValue = (typeof tabs)[number]["value"];

function View() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const tab: TabValue = tabs.some((t) => t.value === param) ? (param as TabValue) : "all";
  const quoteFilter = searchParams.get("quote");
  // What the Create button is doing: asking which kind (All tab), or creating one kind.
  const [create, setCreate] = useState<null | "choose" | "po" | "direct">(null);
  // A Purchase Order is made from a Procurement copy: pick it, then the vendor / PO number form opens for its quote.
  const [poQuote, setPoQuote] = useState<Quote | null>(null);

  const allOrders = usePurchaseOrders().filter((o) => !o.material.proforma);
  const vendors = useVendors();
  // The cards follow the open tab (Vendors shows the totals of both kinds).
  const orders = useMemo(() => allOrders.filter((o) => (tab === "po" ? !o.material.direct : true)), [allOrders, tab]);
  const kpis = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return {
      total: orders.length,
      thisMonth: orders.filter((o) => o.poDate.startsWith(month)).length,
      value: orders.reduce((s, o) => s + poTotals(o).final, 0),
    };
  }, [orders]);

  // Purchase Orders tab: Create makes a normal PO; All asks which kind (a direct PO is made from there).
  const onNew = () => setCreate(tab === "po" ? "po" : "choose");

  return (
    <ProformaStatusProvider>
    <div className="-mx-2 flex flex-col gap-2 lg:-mx-4">
      <div className="px-2">
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Purchase Orders</h1>
        <p className="text-sm font-body text-grey-500">Orders sent to vendors for manufacturing and supply, including direct purchase orders.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiCard compact label="Total POs" value={String(kpis.total)} icon={ShoppingCart} accent="primary" />
        <KpiCard compact label="This Month" value={String(kpis.thisMonth)} icon={CalendarDays} accent="secondary" />
        <KpiCard compact label="Total Value" value={formatInr(kpis.value)} icon={IndianRupee} accent="success" />
        <KpiCard compact label="Vendors" value={String(vendors.length)} icon={Store} accent="teal" />
      </div>

      <Tabs value={tab} onValueChange={(v) => router.replace(`${pathname}?tab=${String(v)}`, { scroll: false })}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {(["all", "po"] as const).map((m) => (
          <TabsContent key={m} value={m} className="pt-0">
            <PurchaseOrdersTable mode={m} onNew={onNew} quoteId={quoteFilter} onClearQuote={() => router.replace(`${pathname}?tab=${m}`, { scroll: false })} />
          </TabsContent>
        ))}
        <TabsContent value="production" className="pt-0">
          <ProformaPackingList mode="production" proforma={false} />
        </TabsContent>
        <TabsContent value="packing" className="pt-0">
          <ProformaPackingList proforma={false} />
        </TabsContent>
        <TabsContent value="vendors" className="pt-0">
          <VendorsTable />
        </TabsContent>
      </Tabs>

      <Dialog open={create === "choose"} onOpenChange={(o) => !o && setCreate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>What do you want to create?</DialogTitle>
            <DialogDescription>A purchase order from a quote, or a direct purchase order made by hand.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button type="button" variant="outline" className="h-auto justify-start py-3" onClick={() => setCreate("po")}>
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">Purchase Order</span>
                <span className="text-xs font-normal text-grey-500">Made from a Procurement copy.</span>
              </span>
            </Button>
            <Button type="button" variant="outline" className="h-auto justify-start py-3" onClick={() => setCreate("direct")}>
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">Direct Purchase Order</span>
                <span className="text-xs font-normal text-grey-500">Made directly, without a quote.</span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <NewPoDialog direct open={create === "direct"} onOpenChange={(o) => !o && setCreate(null)} />
      <CreateFromProcurementDialog open={create === "po"} onOpenChange={(o) => !o && setCreate(null)} onPick={(q) => { setCreate(null); setPoQuote(q); }} />
      <CreatePoDialog quote={poQuote} onOpenChange={(o) => !o && setPoQuote(null)} />
    </div>
    </ProformaStatusProvider>
  );
}

export function PurchaseOrdersView() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
