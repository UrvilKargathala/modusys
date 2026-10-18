"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { asPoStatus, poStatusLabel } from "@/lib/purchase-order";
import { cutListRows } from "@/lib/purchase-order-export";
import { formatPoDate } from "@/components/purchase-orders/po-dates";

// The Packing tab: every Proforma Invoice with how much of it is packed; "Open" goes to its packing page.
export function ProformaPackingList() {
  const router = useRouter();
  const orders = usePurchaseOrders();
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return orders
      .filter((o) => o.material.proforma && `${o.poNumber} ${o.vendorName}`.toLowerCase().includes(q))
      .map((po) => {
        const packing = po.material.packing ?? {};
        const seen = new Map<string, number>();
        let total = 0;
        let packed = 0;
        for (const r of cutListRows(po)) {
          // Same row key as the packing page.
          const base = `${r[0]}|${r[4]}|${r[5]}x${r[6]}`;
          const n = seen.get(base) ?? 0;
          seen.set(base, n + 1);
          const qty = Math.max(0, Number(r[8]) || 0);
          total += qty;
          packed += Math.min(packing[n ? `${base}#${n}` : base]?.packed ?? 0, qty);
        }
        return { po, total, packed };
      });
  }, [orders, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PI no, dealer" className="h-9 w-full rounded-lg border border-grey-100 bg-card pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary" />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={PackageCheck} message="No proforma invoices to pack yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-grey-100 bg-card">
          <table className="w-full text-left text-sm font-body">
            <thead className="bg-light-600 text-grey-700">
              <tr>
                <th className="px-4 py-2 font-medium">PI No</th>
                <th className="px-4 py-2 font-medium">PI Date</th>
                <th className="px-4 py-2 font-medium">Dealer</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Packed</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ po, total, packed }) => (
                <tr key={po.id} className="border-t border-grey-100 text-grey-800">
                  <td className="px-4 py-2 font-number text-primary">{po.poNumber}</td>
                  <td className="px-4 py-2 font-number">{formatPoDate(po.poDate)}</td>
                  <td className="px-4 py-2">{po.vendorName || "—"}</td>
                  <td className="px-4 py-2">{poStatusLabel(asPoStatus(po.status))}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-grey-100">
                        <div className="h-full rounded-full bg-success" style={{ width: `${total ? Math.round((packed / total) * 100) : 0}%` }} />
                      </div>
                      <span className="font-number text-xs text-grey-700">{packed} / {total}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/proforma-invoices/packing/${po.id}`)}>Open</Button>
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
