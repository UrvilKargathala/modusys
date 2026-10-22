"use client";

import { use, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Nums } from "@/components/purchase-orders/purchase-order-sheet";
import { cutListRows, psLabel } from "@/lib/purchase-order-export";
import { usePurchaseOrders, purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { useAllVendors } from "@/lib/store/vendors-store";

// Box stickers for one Transport row of a Proforma Invoice: one sticker per packing box (1 of N ... N of N), each on its own label page
// with the packing slip number, dealer, transport / LR number and what is packed in that box. Prints like the PDFs.
export default function BoxStickersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tr = Number(useSearchParams().get("tr")) || 0;
  const po = usePurchaseOrders().find((o) => o.id === id);
  const vendors = useAllVendors();
  const vendor = vendors.find((v) => v.id === po?.vendorId);

  // Contents per box number: the pieces ticked in this transport, grouped by row.
  const { boxes, total } = useMemo(() => {
    const boxes = new Map<number, Map<string, { cells: (string | number)[]; n: number }>>();
    if (!po) return { boxes, total: 0 };
    const seen = new Map<string, number>();
    for (const r of cutListRows(po)) {
      const base = `${r[0]}|${r[4]}|${r[5]}x${r[6]}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const pieces = po.material.packing?.[n ? `${base}#${n}` : base]?.pieces ?? [];
      for (const p of pieces) {
        if (!p.done || !p.seq || (p.tr ?? 0) !== tr) continue;
        const items = boxes.get(p.seq) ?? new Map();
        const cur = items.get(base) ?? { cells: r, n: 0 };
        cur.n += 1;
        items.set(base, cur);
        boxes.set(p.seq, items);
      }
    }
    const declared = po.material.transport?.[tr]?.boxes ?? 0;
    return { boxes, total: Math.max(declared, ...boxes.keys(), 0) };
  }, [po, tr]);

  useEffect(() => {
    if (po) document.title = `Stickers - ${psLabel(po.poNumber, tr)}`;
  }, [po, tr]);

  if (!po) return <p className="p-6 text-sm font-body text-grey-500">{purchaseOrdersStore.isLoaded() ? "Proforma invoice not found." : "Loading…"}</p>;

  const phone = vendor?.contacts?.find((c) => c.phone)?.phone ?? "";
  const nums = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="po-sheet min-h-screen bg-white">
      <style>{`
        @page { size: 210mm 148mm; margin: 5mm; }
        @media print {
          .sticker-no-print { display: none !important; }
          html, body { background: #fff !important; }
          .sticker { break-after: page; page-break-after: always; border: 1px solid #000 !important; margin: 0 !important; }
          .sticker:last-child { break-after: auto; page-break-after: auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="sticker-no-print flex items-center justify-between p-4">
        <p className="text-sm font-body text-grey-600">{total === 0 ? "No boxes yet: tick pieces and press Finish box on the Packing page, then Save." : <><Nums>{String(total)}</Nums> sticker{total === 1 ? "" : "s"} for <Nums>{psLabel(po.poNumber, tr)}</Nums></>}</p>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-body font-medium text-white hover:opacity-90">
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>
      <div className="flex flex-wrap gap-4 p-4 print:block print:p-0">
        {nums.map((k) => {
          const items = [...(boxes.get(k)?.values() ?? [])];
          return (
            <section key={k} className="sticker flex w-[198mm] flex-col gap-2 rounded-md border border-grey-300 p-4 text-black">
              {/* One horizontal line: company, PS number, PI number, dealer, box number. */}
              <div className="flex items-center justify-between gap-6 border-b border-black pb-2">
                <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-4 whitespace-nowrap">
                  <span className="shrink-0 po-num text-[15px] font-bold"><Nums>{psLabel(po.poNumber, tr)}</Nums></span>
                  <span className="min-w-0 truncate border-l border-black pl-4 text-[15px]">
                    <span className="font-semibold text-grey-600">To, </span>
                    <span className="font-bold">{vendor?.name ?? po.vendorName}</span>
                    {phone && <span className="po-num"> · {phone}</span>}
                  </span>
                </div>
                <p className="shrink-0 whitespace-nowrap border-l border-black pl-4 po-num text-[28px] font-bold leading-none">
                  <span className="mr-3 text-[15px] font-semibold uppercase">Box</span>
                  {k} / {total}
                </p>
              </div>
              <div className="text-[10px]">
                {items.length === 0 ? (
                  <p className="text-grey-500">—</p>
                ) : (
                  <table className="w-full border-collapse text-[9px]">
                    <thead>
                      <tr className="bg-primary text-left uppercase text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                        {["Sr", "Description", "Design", "Width", "Thk", "Height", "Qty", "Sq.Ft", "Material", "Internal Brand & Colour", "External Brand & Colour", "Remarks"].map((h) => (
                          <th key={h} className="border border-grey-300 bg-primary px-1 py-1 font-semibold text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => {
                        const c = it.cells;
                        const rowQty = Number(c[8]) || 1;
                        return (
                          <tr key={i}>
                            <td className="border border-grey-300 px-1 py-0.5 po-num">{c[0]}</td>
                            <td className="border border-grey-300 px-1 py-0.5"><Nums>{`${c[4]}${c[2] && c[2] !== "-" ? ` (${c[2]})` : ""}`}</Nums></td>
                            <td className="border border-grey-300 px-1 py-0.5"><Nums>{String(c[3] ?? "")}</Nums></td>
                            <td className="border border-grey-300 px-1 py-0.5 text-right po-num">{c[5]}</td>
                            <td className="border border-grey-300 px-1 py-0.5 text-right po-num">{c[7]}</td>
                            <td className="border border-grey-300 px-1 py-0.5 text-right po-num">{c[6]}</td>
                            <td className="border border-grey-300 px-1 py-0.5 text-right po-num font-semibold">{it.n}</td>
                            <td className="border border-grey-300 px-1 py-0.5 text-right po-num">{((Number(c[9]) || 0) * it.n / rowQty).toFixed(2)}</td>
                            <td className="border border-grey-300 px-1 py-0.5"><Nums>{String(c[10] ?? "")}</Nums></td>
                            <td className="border border-grey-300 px-1 py-0.5"><Nums>{String(c[11] ?? "")}</Nums></td>
                            <td className="border border-grey-300 px-1 py-0.5"><Nums>{String(c[12] ?? "")}</Nums></td>
                            <td className={`border border-grey-300 px-1 py-0.5 ${c[13] ? "bg-error-200 text-error" : ""}`}><Nums>{String(c[13] ?? "")}</Nums></td>
                          </tr>
                        );
                      })}
                      <tr className="bg-light-600 font-semibold">
                        <td className="border border-grey-300 px-1 py-1 text-right" colSpan={6}>TOTAL</td>
                        <td className="border border-grey-300 px-1 py-1 text-right po-num">{items.reduce((n, it) => n + it.n, 0)}</td>
                        <td className="border border-grey-300 px-1 py-1 text-right po-num">{items.reduce((n, it) => n + ((Number(it.cells[9]) || 0) * it.n) / (Number(it.cells[8]) || 1), 0).toFixed(2)}</td>
                        <td className="border border-grey-300 px-1 py-1" colSpan={4} />
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
