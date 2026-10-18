"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCheck, ChevronDown, ChevronRight, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastStore } from "@/lib/store/toast-store";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useAllVendors } from "@/lib/store/vendors-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { usePurchaseTemplateSettings } from "@/lib/store/quote-template-store";
import { asPoStatus, poStatusLabel, type PoMaterial } from "@/lib/purchase-order";
import { cutListHeaders, cutListRows, poDetailSections } from "@/lib/purchase-order-export";

// The invoice editor's collapsible tinted sections (locked here): same colours and titles, a short summary when closed.
const TONES: Record<string, string> = {
  "Dealer Details": "border-slate/40 border-t-slate bg-slate/30",
  "Proforma Details": "border-taupe/50 border-t-taupe bg-taupe/40",
  "Shutter Details": "border-stone/60 border-t-stone bg-stone/40",
  "Cabinet Details": "border-sand border-t-sand bg-sand/60",
};
function LockedSection({ title, rows }: { title: string; rows: [string, string][] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`rounded-xl border border-t-4 p-4 shadow-sm ${TONES[title] ?? "border-grey-100 bg-light-600"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-grey-600" /> : <ChevronRight className="h-4 w-4 shrink-0 text-grey-600" />}
        <h2 className="font-heading text-lg font-semibold text-grey-900">{title}</h2>
        {!open && <span className="ml-auto truncate pl-4 text-sm font-body text-grey-600">{rows[0]?.[1]}</span>}
      </button>
      {open && (
        <div className="grid gap-x-6 gap-y-4 pt-4 md:grid-cols-2 xl:grid-cols-4">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 text-sm font-body">
              <span className="text-xs font-semibold text-grey-700">{k}</span>
              <span className="whitespace-pre-line font-number text-grey-900">{v || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type Packing = NonNullable<PoMaterial["packing"]>;

// The Packing page of a Proforma Invoice: everything about the invoice is shown but locked; only Packed Qty, the Packed tick
// and Notes of each component row can be changed. Saved on the invoice (material.packing), keyed by the row.
export function ProformaPackingPage({ id }: { id: string }) {
  const router = useRouter();
  const po = usePurchaseOrders().find((o) => o.id === id);
  const vendors = useAllVendors();
  const customers = useCustomers();
  const quotes = useQuotes();
  const settings = usePurchaseTemplateSettings();
  const [packing, setPacking] = useState<Packing>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState("");
  // Bulk edit: rows ticked in the first column, changed together from the bar above the table.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkNote, setBulkNote] = useState("");

  useEffect(() => {
    if (po && seeded !== po.id) {
      setPacking(po.material.packing ?? {});
      setSeeded(po.id);
    }
  }, [po, seeded]);

  const headers = useMemo(() => (po ? cutListHeaders(po) : []), [po]);
  // Row key: Sr no + description + size; identical rows get a running number so each keeps its own packing state.
  const rows = useMemo(() => {
    if (!po) return [];
    const seen = new Map<string, number>();
    return cutListRows(po).map((r) => {
      const base = `${r[0]}|${r[4]}|${r[5]}x${r[6]}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return { key: n ? `${base}#${n}` : base, cells: r };
    });
  }, [po]);

  if (!po) return <p className="p-6 text-sm font-body text-grey-500">{purchaseOrdersStore.isLoaded() ? "Proforma invoice not found." : "Loading…"}</p>;
  if (!po.material.proforma) return <p className="p-6 text-sm font-body text-grey-500">This page is only for Proforma Invoices.</p>;

  const vendor = vendors.find((v) => v.id === po.vendorId);
  const customer = customers.find((c) => c.id === po.customerId);
  const quoteNumber = quotes.find((q) => q.id === po.quoteId)?.quoteNumber;
  const sections = poDetailSections(po, { vendor, vendors, customer, quoteNumber, branding: settings.branding });

  const qtyOf = (cells: (string | number)[]) => Math.max(0, Number(cells[8]) || 0);
  const set = (key: string, patch: Partial<{ packed: number; note: string }>) => {
    setPacking((p) => ({ ...p, [key]: { ...(p[key] ?? { packed: 0, note: "" }), ...patch } }));
    setDirty(true);
  };
  const totalQty = rows.reduce((n, r) => n + qtyOf(r.cells), 0);
  const totalPacked = rows.reduce((n, r) => n + Math.min(packing[r.key]?.packed ?? 0, qtyOf(r.cells)), 0);

  const bulk = (fn: (key: string, qty: number, cur: { packed: number; note: string }) => { packed: number; note: string }) => {
    setPacking((p) => {
      const next = { ...p };
      for (const r of rows) if (picked.has(r.key)) next[r.key] = fn(r.key, qtyOf(r.cells), p[r.key] ?? { packed: 0, note: "" });
      return next;
    });
    setDirty(true);
  };
  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.key));
  const togglePick = (key: string) => setPicked((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const save = async (): Promise<boolean> => {
    setBusy(true);
    try {
      await purchaseOrdersStore.update(po.id, { material: { ...po.material, packing } });
      setDirty(false);
      toastStore.show("Packing saved", "success");
      return true;
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not save packing", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Columns shown: the cut list's, minus Sq.Ft (Qty stays, as the ordered quantity).
  const shown = headers.map((h, i) => ({ h, i })).filter(({ h }) => h !== "Sq.Ft");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/proforma-invoices/packing" className="rounded-md p-1.5 text-grey-500 hover:bg-light-600 hover:text-primary" aria-label="Back to Packing">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-grey-900">Packing <span className="font-number text-lg font-normal text-grey-600">({po.poNumber})</span></h1>
            <p className="text-sm font-body text-grey-500">Status: {poStatusLabel(asPoStatus(po.status))}. Only Packed Qty, the tick and Notes can be changed.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => router.push("/proforma-invoices/packing")}>
            <X className="h-4 w-4" /> {dirty ? "Cancel" : "Close"}
          </Button>
          <Button type="button" size="sm" disabled={busy || !dirty} onClick={async () => { if (await save()) router.push("/proforma-invoices/packing"); }}>
            <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {sections.map((sec) => <LockedSection key={sec.title} title={sec.title} rows={sec.rows} />)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-grey-100 bg-white px-5 py-3 shadow-sm">
        <div className="flex min-w-60 flex-1 items-center gap-3">
          <span className="font-heading text-base font-semibold text-grey-900">Components</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-grey-100">
            <div className="h-full rounded-full bg-success" style={{ width: `${totalQty ? Math.round((totalPacked / totalQty) * 100) : 0}%` }} />
          </div>
          <span className="font-number text-sm text-grey-700">{totalPacked} / {totalQty} packed</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setPacking(Object.fromEntries(rows.map((r) => [r.key, { packed: qtyOf(r.cells), note: packing[r.key]?.note ?? "" }])));
            setDirty(true);
          }}
        >
          <CheckCheck className="h-4 w-4" /> Mark all packed
        </Button>
      </div>

      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-transparent px-4 py-2 text-sm font-body text-grey-800">
          <span className="font-medium">{picked.size} selected</span>
          <Button type="button" size="sm" variant="outline" onClick={() => bulk((_k, qty, c) => ({ ...c, packed: qty }))}>Mark packed</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => bulk((_k, _q, c) => ({ ...c, packed: 0 }))}>Mark not packed</Button>
          <Input value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="Note for selected" className="h-8 w-56 text-xs" />
          <Button type="button" size="sm" variant="outline" disabled={!bulkNote.trim()} onClick={() => bulk((_k, _q, c) => ({ ...c, note: bulkNote.trim() }))}>Set note</Button>
          <button type="button" onClick={() => setPicked(new Set())} className="ml-auto text-xs text-grey-500 hover:text-primary">Clear selection</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-grey-100 bg-white shadow-sm">
        <table className="w-full text-left text-xs font-body">
          <thead className="bg-light-600 text-grey-700">
            <tr>
              <th className="px-2 py-2"><input type="checkbox" aria-label="Select all rows" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.key)))} className="h-4 w-4 accent-primary" /></th>
              {shown.map(({ h }) => <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>)}
              <th className="whitespace-nowrap px-2 py-2 font-medium">Packed Qty</th>
              <th className="px-2 py-2 text-center font-medium">Packed</th>
              <th className="px-2 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, cells }) => {
              const qty = qtyOf(cells);
              const st = packing[key] ?? { packed: 0, note: "" };
              const full = qty > 0 && st.packed >= qty;
              return (
                <tr key={key} className={`border-t border-grey-100 text-grey-800 ${full ? "bg-success-transparent" : ""}`}>
                  <td className="px-2 py-1"><input type="checkbox" aria-label={`Select row ${cells[0]}`} checked={picked.has(key)} onChange={() => togglePick(key)} className="h-4 w-4 accent-primary" /></td>
                  {shown.map(({ h, i }) => (
                    <td key={h} className="whitespace-nowrap px-2 py-1.5 font-number">{cells[i]}</td>
                  ))}
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      min={0}
                      max={qty}
                      value={st.packed || ""}
                      onChange={(e) => set(key, { packed: Math.min(qty, Math.max(0, Number(e.target.value) || 0)) })}
                      className="h-7 w-20 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" aria-label={`Row ${cells[0]} fully packed`} checked={full} onChange={(e) => set(key, { packed: e.target.checked ? qty : 0 })} className="h-4 w-4 accent-primary" />
                  </td>
                  <td className="px-2 py-1">
                    <Input value={st.note} onChange={(e) => set(key, { note: e.target.value })} className="h-7 min-w-40 text-xs" />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={shown.length + 4} className="px-3 py-6 text-center text-grey-400">This invoice has no component rows yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
