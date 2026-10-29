"use client";

import { useMemo, useState } from "react";
import { PackageCheck, Search } from "lucide-react";
import { ProformaStatusCell } from "@/components/purchase-orders/proforma-status-cell";
import { PoRowActions } from "@/components/purchase-orders/po-row-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { asPoStatus } from "@/lib/purchase-order";
import { cutListRows } from "@/lib/purchase-order-export";
import { formatPoDate } from "@/components/purchase-orders/po-dates";

// The Packing & Dispatch tab: the Proforma Invoices whose status is Packing, with how much of each is packed; "Open" goes to its packing page.
// mode "production" (Work Order) lists the invoices that are In Production; "manufacturing" lists the same invoices with how many pieces are
// through every factory step (material.manufacturing).
// proforma false: the Work Order and Packing tabs for Purchase Orders and Direct POs (the Purchase Orders page).
export function ProformaPackingList({ mode = "packing", proforma = true }: { mode?: "packing" | "production" | "manufacturing"; proforma?: boolean }) {
  const isProd = mode === "production";
  const isMfg = mode === "manufacturing";
  const title = isProd ? "Work Order" : isMfg ? "Manufacturing" : "Packing";
  const orders = usePurchaseOrders();
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return orders
      .filter((o) => !!o.material.proforma === proforma && asPoStatus(o.status).toLowerCase() === (isProd || isMfg ? "in-production" : "packing") && `${o.poNumber} ${o.vendorName}`.toLowerCase().includes(q))
      .map((po) => {
        const packing = (isMfg ? po.material.manufacturing : po.material.packing) ?? {};
        const seen = new Map<string, number>();
        let total = 0;
        let packed = 0;
        for (const r of cutListRows(po, true)) {
          // Same row key as the packing page.
          const base = `${r[0]}|${r[4]}|${r[5]}x${r[6]}`;
          const n = seen.get(base) ?? 0;
          seen.set(base, n + 1);
          const qty = Math.max(0, Number(r[8]) || 0);
          total += qty;
          packed += (packing[n ? `${base}#${n}` : base]?.pieces ?? []).slice(0, qty).filter((x) => x.done).length;
        }
        return { po, total, packed };
      });
  }, [orders, search, isProd, isMfg, proforma]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={proforma ? "Search PI no, dealer" : "Search PO no, vendor"} className="h-9 w-full rounded-lg border border-grey-100 bg-card pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary" />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={PackageCheck} message={`No ${proforma ? "proforma invoices" : "purchase orders"} in ${title}. Change ${proforma ? "an invoice's" : "an order's"} status to ${isProd || isMfg ? "In Production" : "Packing"} and it appears here.`} />
      ) : (
        <div className="overflow-x-auto [&_tr>*:first-child]:pl-2 [&_tr>*:last-child]:pr-2 [&_tbody_tr]:h-8 [&_td]:align-middle">
          <table className="w-full text-left text-xs font-body">
            <thead className="bg-[var(--table-head)] text-grey-900">
              <tr>
                <th className="px-2 py-0.5 font-medium">{proforma ? "PI No" : "PO No"}</th>
                <th className="px-2 py-0.5 font-medium">{proforma ? "PI Date" : "Date"}</th>
                <th className="px-2 py-0.5 font-medium">{proforma ? "Dealer" : "Vendor"}</th>
                <th className="px-2 py-0.5 font-medium">Status</th>
                {!isProd && <th className="w-[35%] px-2 py-0.5 font-medium">{isMfg ? "Through all steps" : "Packed"}</th>}
                <th className="px-2 py-0.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ po, total, packed }) => (
                <tr key={po.id} className="text-grey-800 hover:bg-light-600/60">
                  <td className="px-2 py-0.5 font-number text-primary">{po.poNumber}</td>
                  <td className="px-2 py-0.5 font-number">{formatPoDate(po.poDate)}</td>
                  <td className="px-2 py-0.5">{po.vendorName || "—"}</td>
                  <td className="px-2 py-0.5"><ProformaStatusCell po={po} /></td>
                  {!isProd && <td className="px-2 py-0.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-grey-100">
                        <div className="h-full rounded-full bg-success" style={{ width: `${total ? Math.round((packed / total) * 100) : 0}%` }} />
                      </div>
                      <span className="font-number text-xs text-grey-700">{packed} / {total}</span>
                    </div>
                  </td>}
                  <td className="px-2 py-0.5">
                    <PoRowActions po={po} proforma={proforma} base={proforma ? "/proforma-invoices" : po.material.direct ? "/direct-purchase-orders" : "/purchase-orders"} packingSlips={mode === "packing"} workOrder={isProd} viewHref={`${proforma ? "/proforma-invoices" : "/purchase-orders"}/${mode}/${po.id}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
