"use client";

import { useContext, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PoBrandVendorContext } from "@/components/purchase-orders/po-lines-table";
import { formatInr } from "@/lib/format";
import { useVendors } from "@/lib/store/vendors-store";
import { lineAmount, type PurchaseOrderLine } from "@/lib/purchase-order";

// One delivery of a hardware item: bill no, qty, date and a remark. Received Qty = the sum of its deliveries.
export type HardwareReceipt = { id: string; billNo: string; qty: number; date: string; remark: string };
export type HardwareStock = Record<string, { stock?: number; vendorId?: string; receipts?: HardwareReceipt[] }>;

// Same item = same brand, description, article no, category and unit, across every cabinet.
export const hardwareKey = (l: PurchaseOrderLine) => [l.brand, l.description, l.articleNo, l.category, l.unit].join("|").toLowerCase();

const th = "whitespace-nowrap px-2 py-2 text-xs font-body font-semibold uppercase tracking-wide text-grey-900";
const td = "px-2 py-2 text-[13px] font-body text-grey-900";
const num = "text-right font-number";
const q = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
// Stock / Order / Received / Balance always show two decimals, centred.
const d2 = (n: number) => n.toFixed(2);

// No up/down spinner arrows on the number boxes.
const noSpin = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const input =
  `h-8 w-16 rounded-md border border-grey-100 bg-card px-2 text-center font-number text-[13px] text-grey-900 outline-none focus:border-primary ${noSpin}`;
// Number box showing two decimals (2.00); while you type it shows what you type.
function QtyBox({ value, label, onCommit }: { value?: number; label: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      type="number"
      min={0}
      step="any"
      aria-label={label}
      className={input}
      value={text ?? (value === undefined ? "" : value.toFixed(2))}
      onFocus={() => setText(value === undefined ? "" : String(value))}
      onChange={(e) => {
        setText(e.target.value);
        onCommit(e.target.value);
      }}
      onBlur={() => setText(null)}
    />
  );
}

const sum = (rs?: HardwareReceipt[]) => (rs ?? []).reduce((t, r) => t + (r.qty || 0), 0);

const newReceipt = (): HardwareReceipt => ({ id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, billNo: "", qty: 0, date: new Date().toISOString().slice(0, 10), remark: "" });

// Popup for one hardware item: a numbered list of deliveries (bill no, qty, date, remark); + adds another one.
function ReceivedDialog({
  title,
  vendorId: savedVendorId,
  receipts,
  onSave,
  onClose,
}: {
  title: string;
  // The vendor picked here earlier ("" = none yet; it is not filled in automatically).
  vendorId: string;
  receipts: HardwareReceipt[];
  onSave: (receipts: HardwareReceipt[], vendorId: string) => void;
  onClose: () => void;
}) {
  const vendors = useVendors();
  const [vendorId, setVendorId] = useState(savedVendorId);
  const vendor = vendors.find((v) => v.id === vendorId);
  const [rows, setRows] = useState<HardwareReceipt[]>(receipts.length ? receipts.map((r) => ({ ...r })) : [newReceipt()]);
  const patch = (id: string, fields: Partial<HardwareReceipt>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  const cell = "h-8 w-full rounded-md border border-grey-100 bg-card px-2 text-[13px] font-body text-grey-900 outline-none focus:border-primary";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Received Qty</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-grey-100 bg-light-600 px-3 py-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-grey-500">Vendor</span>
            <select
              aria-label="Vendor"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="h-8 w-full min-w-0 rounded-md border border-grey-100 bg-card px-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
            >
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          {[["GST No", vendor?.gst], ["City", [vendor?.city, vendor?.state].filter(Boolean).join(", ")]].map(([k, v]) => (
            <div key={k} className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-grey-500">{k}</span>
              <span className="flex h-8 items-center truncate font-number text-sm text-grey-900">{v || "—"}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[2.5rem_1fr_6rem_9rem_1.2fr_2rem] items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-grey-500">
            <span>Sr</span><span>Bill No</span><span className="text-right">Qty</span><span>Date</span><span>Remark</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={r.id} className="grid grid-cols-[2.5rem_1fr_6rem_9rem_1.2fr_2rem] items-center gap-2">
              <span className="px-1 font-number text-sm text-grey-500">{i + 1}</span>
              <input aria-label="Bill No" className={cell} value={r.billNo} onChange={(e) => patch(r.id, { billNo: e.target.value })} />
              <input aria-label="Qty" type="number" min={0} step="any" className={`${cell} text-right font-number ${noSpin}`} value={r.qty || ""} onChange={(e) => patch(r.id, { qty: Math.max(0, Number(e.target.value) || 0) })} />
              <input aria-label="Date" type="date" className={cell} value={r.date} onChange={(e) => patch(r.id, { date: e.target.value })} />
              <input aria-label="Remark" className={cell} value={r.remark} onChange={(e) => patch(r.id, { remark: e.target.value })} />
              <button type="button" aria-label="Remove" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, newReceipt()])}>
              <Plus className="h-3.5 w-3.5" />
              Add another
            </Button>
          </div>
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-sm font-body text-grey-500">Total received: <span className="font-number font-semibold text-grey-900">{q(sum(rows))}</span></span>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={() => onSave(rows.filter((r) => r.billNo.trim() || r.qty || r.remark.trim()), vendorId)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hardware tab: every hardware row of the PO merged by item across all units (quantities added up). Qty is read-only.
// Stock Qty is typed by hand; Received Qty is the sum of the deliveries added with the + button (bill no, qty, date, remark).
// Order Qty = Qty - Stock Qty (never below 0); Balance Qty = Order Qty - Received Qty. All saved on the PO.
export function PoHardwareTab({
  lines,
  stock,
  onStockChange,
}: {
  lines: PurchaseOrderLine[];
  stock: HardwareStock;
  onStockChange: (key: string, patch: { stock?: number; vendorId?: string; receipts?: HardwareReceipt[] }) => void;
}) {
  const brandVendor = useContext(PoBrandVendorContext);
  const [receiving, setReceiving] = useState<string | null>(null);
  const rows = useMemo(() => {
    const byKey = new Map<string, { key: string; l: PurchaseOrderLine; qty: number; amount: number; mrps: Set<number>; discounts: Set<number> }>();
    for (const l of lines.filter((x) => x.group === "hardware")) {
      const key = hardwareKey(l);
      const hit = byKey.get(key) ?? { key, l, qty: 0, amount: 0, mrps: new Set<number>(), discounts: new Set<number>() };
      hit.qty += l.qty;
      hit.amount += lineAmount(l);
      hit.mrps.add(l.rate);
      hit.discounts.add(l.discountPct ?? 0);
      byKey.set(key, hit);
    }
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
    return [...byKey.values()].sort((a, b) => cmp(a.l.brand, b.l.brand) || cmp(a.l.category, b.l.category) || cmp(a.l.description, b.l.description));
  }, [lines]);

  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">No hardware rows yet.</p>;
  }

  const setStock = (key: string, v: string) => onStockChange(key, { stock: v === "" ? undefined : Math.max(0, Number(v)) });
  const open = rows.find((r) => r.key === receiving);

  return (
    <div className="overflow-x-auto rounded-lg border border-grey-100">
      <table className="w-full min-w-max text-left">
        <thead className="bg-ice-300">
          <tr>
            {["Sr", "Brand", "Vendor", "Description", "Article No", "Category", "Unit"].map((h) => <th key={h} className={th}>{h}</th>)}
            {["Qty", "MRP", "Discount %", "Amount"].map((h) => <th key={h} className={`${th} text-right`}>{h}</th>)}
            {["Stock Qty", "Order Qty", "Received Qty", "Balance Qty"].map((h) => <th key={h} className={`${th} text-center`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const s = stock[r.key] ?? {};
            const order = Math.max(0, r.qty - (s.stock ?? 0));
            const received = sum(s.receipts);
            const balance = order - received;
            return (
              <tr key={r.key} className="border-t border-grey-100">
                <td className={`${td} font-number text-grey-500`}>{i + 1}</td>
                <td className={td}>{r.l.brand}</td>
                <td className={`${td} text-grey-700`}>{brandVendor(r.l.brand) || "—"}</td>
                <td className={`${td} min-w-64`}>{r.l.description}</td>
                <td className={`${td} font-number`}>{r.l.articleNo}</td>
                <td className={td}>{r.l.category}</td>
                <td className={td}>{r.l.unit}</td>
                <td className={`${td} ${num} font-semibold`}>{q(r.qty)}</td>
                <td className={`${td} ${num}`}>{r.mrps.size > 1 ? "Mixed" : formatInr(r.l.rate)}</td>
                <td className={`${td} ${num}`}>{r.discounts.size > 1 ? "Mixed" : q(r.l.discountPct ?? 0)}</td>
                <td className={`${td} ${num}`}>{formatInr(r.amount)}</td>
                <td className={`${td} text-center`}>
                  <QtyBox label="Stock Qty" value={s.stock} onCommit={(v) => setStock(r.key, v)} />
                </td>
                <td className={`${td} text-center font-number font-semibold`}>{d2(order)}</td>
                <td className={td}>
                  <div className="flex items-center justify-center gap-1.5">
                    <span aria-label="Received Qty" className="flex h-8 w-16 items-center justify-center rounded-md border border-grey-100 bg-light-600 px-2 font-number text-[13px] text-grey-900">{d2(received)}</span>
                    <Button type="button" size="icon-sm" variant="outline" aria-label="Add received qty" title="Add what was received: bill no, qty, date, remark" onClick={() => setReceiving(r.key)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
                <td className={`${td} text-center font-number font-semibold ${balance < 0 ? "text-error" : ""}`}>{d2(balance)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {open && (
        <ReceivedDialog
          key={open.key}
          title={`${open.l.brand ? `${open.l.brand} · ` : ""}${open.l.description}`}
          vendorId={stock[open.key]?.vendorId ?? ""}
          receipts={stock[open.key]?.receipts ?? []}
          onSave={(receipts, vendorId) => {
            onStockChange(open.key, { receipts, vendorId });
            setReceiving(null);
          }}
          onClose={() => setReceiving(null)}
        />
      )}
    </div>
  );
}
