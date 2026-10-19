"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Printer, RotateCcw, Save, Tag, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SelectField } from "@/components/shared/select-field";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { Input } from "@/components/ui/input";
import { toastStore } from "@/lib/store/toast-store";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useAllVendors } from "@/lib/store/vendors-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { usePurchaseTemplateSettings } from "@/lib/store/quote-template-store";
import { asPoStatus, poStatusLabel, type PoMaterial } from "@/lib/purchase-order";
import { cutListHeaders, cutListRows, poDetailSections, psLabel } from "@/lib/purchase-order-export";

// The invoice editor's tinted sections (locked here): same colours and titles, always shown in full.
const TONES: Record<string, string> = {
  "Dealer Details": "border-slate/40 border-t-slate bg-slate/30",
  "Proforma Details": "border-taupe/50 border-t-taupe bg-taupe/40",
  "Shutter Details": "border-stone/60 border-t-stone bg-stone/40",
  "Cabinet Details": "border-sand border-t-sand bg-sand/60",
};
function LockedSection({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className={`rounded-xl border border-t-4 p-4 shadow-sm ${TONES[title] ?? "border-grey-100 bg-light-600"}`}>
      <h2 className="mb-3 font-heading text-lg font-semibold text-grey-900">{title}</h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 xl:grid-cols-3">
        {rows.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="flex flex-col gap-0.5 text-sm font-body">
            <span className="text-xs font-semibold text-grey-700">{k}</span>
            <span className="whitespace-pre-line font-number text-grey-900">{v || "—"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

type Packing = NonNullable<PoMaterial["packing"]>;

// The Packing page of a Proforma Invoice: everything about the invoice is shown but locked; only the Packed ticks (one per piece, Qty of them)
// and each piece's note can be changed. Saved on the invoice (material.packing), keyed by the row.
// mode "production" is the same page for the Production tab: produced ticks and notes only (no transport, boxes or numbers).
export function ProformaPackingPage({ id, mode = "packing" }: { id: string; mode?: "packing" | "production" }) {
  const isProd = mode === "production";
  const base = `/proforma-invoices/${mode}`;
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
  // Show all rows, only the pieces still to pack, or only those already packed.
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  // Dropdowns in the Packing Box heading: only the boxes of one packing slip (A, B, C ...) and / or one box number (1, 2, 3 ...) of it.
  const [slipPick, setSlipPick] = useState("");
  const [boxPick, setBoxPick] = useState("");
  // Transport Details rows (name picked from Proforma Library > Transport Details).
  const [transport, setTransport] = useState<NonNullable<PoMaterial["transport"]>>([]);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteTransport, setDeleteTransport] = useState<number | null>(null);
  const transportNames = useMaterialItems("proforma-transport");

  useEffect(() => {
    if (po && seeded !== po.id) {
      setPacking((isProd ? po.material.production : po.material.packing) ?? {});
      // One empty Transport row is there from the start.
      setTransport(po.material.transport?.length ? po.material.transport : [{ name: "", lr: "", date: "", boxes: 0 }]);
      setSeeded(po.id);
    }
  }, [po, seeded, isProd]);

  const headers = useMemo(() => (po ? cutListHeaders(po) : []), [po]);
  // Row key: Sr no + description + size; identical rows get a running number so each keeps its own packing state.
  const rows = useMemo(() => {
    if (!po) return [];
    const seen = new Map<string, number>();
    const list = cutListRows(po).map((r) => {
      const base = `${r[0]}|${r[4]}|${r[5]}x${r[6]}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return { key: n ? `${base}#${n}` : base, cells: r };
    });
    // Listed in Sr order (1.1, 1.2 ... 2.1 ...), not in the cut list's material order; loose rows (Sr 0.x, no cabinet) come last.
    const part = (sr: string | number) => String(sr).split(".").map(Number);
    return list.sort((a, b) => {
      const [ac, ar] = part(a.cells[0]);
      const [bc, br] = part(b.cells[0]);
      return (ac === 0 ? Infinity : ac) - (bc === 0 ? Infinity : bc) || ar - br;
    });
  }, [po]);

  if (!po) return <p className="p-6 text-sm font-body text-grey-500">{purchaseOrdersStore.isLoaded() ? "Proforma invoice not found." : "Loading…"}</p>;
  if (!po.material.proforma) return <p className="p-6 text-sm font-body text-grey-500">This page is only for Proforma Invoices.</p>;

  const vendor = vendors.find((v) => v.id === po.vendorId);
  const customer = customers.find((c) => c.id === po.customerId);
  const quoteNumber = quotes.find((q) => q.id === po.quoteId)?.quoteNumber;
  const sections = poDetailSections(po, { vendor, vendors, customer, quoteNumber, branding: settings.branding });

  const qtyOf = (cells: (string | number)[]) => Math.max(0, Number(cells[8]) || 0);
  // seq = the box number (1, 2, 3 …) of the piece within its transport (tr = that Transport row's index): pieces ticked together share one;
  // each new Transport row starts counting from 1 again.
  type Piece = { done: boolean; note: string; seq?: number; tr?: number };
  const currentTr = Math.max(0, transport.length - 1);
  // Highest box number so far in a transport.
  const maxSeq = (all: Packing, tr: number) => Math.max(0, ...Object.values(all).flatMap((v) => v.pieces.map((x) => (x.done && (x.tr ?? 0) === tr ? x.seq ?? 0 : 0))));
  // A row's pieces, always exactly Qty long.
  const piecesOf = (key: string, qty: number): Piece[] => Array.from({ length: qty }, (_, k) => packing[key]?.pieces?.[k] ?? { done: false, note: "" });
  const setPiece = (key: string, qty: number, k: number, patch: Partial<Piece>) => {
    setPacking((p) => {
      const cur = Array.from({ length: qty }, (_, i) => p[key]?.pieces?.[i] ?? { done: false, note: "" });
      cur[k] = { ...cur[k], ...patch };
      if (patch.done === false) { delete cur[k].seq; delete cur[k].tr; }
      return { ...p, [key]: { pieces: cur } };
    });
    setDirty(true);
  };
  const totalQty = rows.reduce((n, r) => n + qtyOf(r.cells), 0);
  type PieceLike = { done: boolean; seq?: number; tr?: number };
  const matches = (x: PieceLike) =>
    (filter === "all" || (filter === "pending" ? !x.done : x.done)) &&
    (!slipPick || (x.done && String(x.tr ?? 0) === slipPick)) &&
    (!boxPick || (x.done && String(x.seq ?? "") === boxPick));
  const visibleRows = rows.filter((r) => piecesOf(r.key, qtyOf(r.cells)).some((x) => matches(x)));
  // Box numbers that exist for the picked slip (or for all slips).
  const boxNumbers = [...new Set(rows.flatMap((r) => piecesOf(r.key, qtyOf(r.cells))).filter((x) => x.done && x.seq && (!slipPick || String(x.tr ?? 0) === slipPick)).map((x) => x.seq as number))].sort((a, b) => a - b);
  const totalPacked = rows.reduce((n, r) => n + piecesOf(r.key, qtyOf(r.cells)).filter((x) => x.done).length, 0);

  // Clicking a note box gives its group its number straight away: every ticked piece that has no number yet (ticked together) gets the next one.
  const numberGroup = () => {
    setPacking((p) => {
      const max = maxSeq(p, currentTr);
      const next = { ...p };
      for (const r of rows) {
        const cur = Array.from({ length: qtyOf(r.cells) }, (_, i) => p[r.key]?.pieces?.[i] ?? { done: false, note: "" });
        next[r.key] = { pieces: cur.map((x) => (x.done && !x.seq ? { ...x, seq: max + 1, tr: currentTr } : x)) };
      }
      return next;
    });
    setDirty(true);
  };
  // Finish = close the box: any ticked piece that has no box number yet gets the next number, the last Transport row's Number of Boxes
  // becomes the number of boxes so far, and a new Transport row is added for the next transport.
  const unnumbered = rows.reduce((n, r) => n + piecesOf(r.key, qtyOf(r.cells)).filter((x) => x.done && !x.seq).length, 0);
  const finishBox = () => {
    const max = maxSeq(packing, currentTr);
    const seq = unnumbered > 0 ? max + 1 : max;
    if (unnumbered > 0) {
      setPacking((p) => {
        const next = { ...p };
        for (const r of rows) {
          const cur = Array.from({ length: qtyOf(r.cells) }, (_, i) => p[r.key]?.pieces?.[i] ?? { done: false, note: "" });
          next[r.key] = { pieces: cur.map((x) => (x.done && !x.seq ? { ...x, seq, tr: currentTr } : x)) };
        }
        return next;
      });
    }
    // The current transport gets its box count and a fresh row is added for the next one (box numbers start again from 1 there).
    setTransport((t) => [...(t.length ? t.map((x, i) => (i === t.length - 1 ? { ...x, boxes: seq } : x)) : [{ name: "", lr: "", date: "", boxes: seq }]), { name: "", lr: "", date: "", boxes: 0 }]);
    setDirty(true);
  };
  // Typing a note writes it to the whole group of the piece being edited: the ticked pieces with the same box number, or, before
  // Finish, all ticked pieces that have no box number yet.
  const shareNote = (editedSeq: number | undefined, editedTr: number | undefined, note: string) => {
    setPacking((p) => {
      const next = { ...p };
      for (const r of rows) {
        const qty = qtyOf(r.cells);
        const cur = Array.from({ length: qty }, (_, i) => p[r.key]?.pieces?.[i] ?? { done: false, note: "" });
        next[r.key] = { pieces: cur.map((x) => (x.done && x.seq === editedSeq && (x.tr ?? 0) === (editedTr ?? 0) ? { ...x, note } : x)) };
      }
      return next;
    });
    setDirty(true);
  };

  const save = async (): Promise<boolean> => {
    setBusy(true);
    try {
      await purchaseOrdersStore.update(po.id, { material: isProd ? { ...po.material, production: packing } : { ...po.material, packing, transport } });
      setDirty(false);
      toastStore.show(isProd ? "Production saved" : "Packing saved", "success");
      return true;
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : isProd ? "Could not save production" : "Could not save packing", "error");
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
          <Link href={base} className="rounded-md p-1.5 text-grey-500 hover:bg-light-600 hover:text-primary" aria-label={isProd ? "Back to Production" : "Back to Packing"}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-grey-900">{isProd ? "Production" : "Packing"} <span className="font-number text-lg font-normal text-grey-600">({po.poNumber})</span></h1>
            <p className="text-sm font-body text-grey-500">Status: {poStatusLabel(asPoStatus(po.status))}. {isProd ? "Only the produced ticks and notes can be changed." : "Only the packed ticks and notes can be changed."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => router.push(base)}>
            <X className="h-4 w-4" /> {dirty ? "Cancel" : "Close"}
          </Button>
          <Button type="button" size="sm" disabled={busy || !dirty} onClick={async () => { if (await save()) router.push(base); }}>
            <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Only Dealer and Proforma details are shown on the Packing page. */}
        {sections.filter((sec) => sec.title === "Dealer Details" || sec.title === "Proforma Details").map((sec) => <LockedSection key={sec.title} title={sec.title} rows={sec.rows.filter(([k]) => k !== "GST No" && k !== "Contact" && k !== "Status")} />)}
      </div>

      {/* Transport Details: several transports can be added; the name comes from Proforma Library > Transport Details. */}
      {!isProd && (
      <section className="rounded-xl border border-grey-100 bg-[#2391FF]/20 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-grey-900">Packing and Transport Details</h2>
        </div>
        {transport.length === 0 ? (
          <p className="text-sm font-body text-grey-400">Transport rows are added automatically when you press Finish box.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {transport.map((t, i) => (
              <div key={i} className="grid items-end gap-3 md:grid-cols-[2.25rem_max-content_minmax(0,1.3fr)_minmax(0,1fr)_10.5rem_7rem_max-content]">
                <span className="pb-2 font-number text-sm text-grey-500">{String(i + 1).padStart(3, "0")}</span>
                <span className="whitespace-nowrap pb-2 font-number text-sm font-semibold text-grey-700">{psLabel(po.poNumber, i)}</span>
                <label className="flex flex-col gap-1 text-xs font-semibold text-grey-700">
                  {i === 0 && "Transport Name"}
                  <SelectField aria-label="Transport Name" value={t.name} onChange={(e) => { setTransport((r) => r.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))); setDirty(true); }} className="h-9 rounded-lg border border-black bg-white px-3 text-sm font-body text-grey-900 outline-none focus:border-primary">
                    <option value="">Select transport…</option>
                    {transportNames.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </SelectField>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-grey-700">
                  {i === 0 && "LR Number"}
                  <Input aria-label="LR Number" value={t.lr} onChange={(e) => { setTransport((r) => r.map((x, j) => (j === i ? { ...x, lr: e.target.value } : x))); setDirty(true); }} className="h-9 border-black bg-white font-number" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-grey-700">
                  {i === 0 && "Date"}
                  <Input aria-label="Transport date" type="date" value={t.date ?? ""} onChange={(e) => { setTransport((r) => r.map((x, j) => (j === i ? { ...x, date: e.target.value } : x))); setDirty(true); }} className="h-9 border-black bg-white font-number" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-grey-700">
                  {i === 0 && "Number of Boxes"}
                  <Input aria-label="Number of Boxes" type="number" min={0} value={t.boxes || ""} onChange={(e) => { setTransport((r) => r.map((x, j) => (j === i ? { ...x, boxes: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x))); setDirty(true); }} className="h-9 border-black bg-white font-number [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                </label>
                <div className="mb-1 flex items-center gap-1">
                  <button type="button" aria-label="Delete this transport" onClick={() => setDeleteTransport(i)} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-grey-500 hover:bg-light-600 hover:text-error">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                  <button type="button" aria-label="Print this packing slip" onClick={() => window.open(`/purchase-orders/${po.id}/pdf?part=packing-transport&tr=${i}`, "_blank")} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-grey-500 hover:bg-light-600 hover:text-primary">
                    <Printer className="h-4 w-4" /> Print
                  </button>
                  <button type="button" aria-label="Print box stickers" onClick={() => window.open(`/purchase-orders/${po.id}/stickers?tr=${i}`, "_blank")} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-grey-500 hover:bg-light-600 hover:text-primary">
                    <Tag className="h-4 w-4" /> Sticker
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={isProd ? "Reset all production?" : "Reset all packing?"}
        description={isProd ? "This unticks every box and clears all production notes. It is only saved when you press Save." : "This unticks every box and clears all packing notes and box numbers. It is only saved when you press Save."}
        onConfirm={() => {
          setPacking(Object.fromEntries(rows.map((r) => [r.key, { pieces: Array.from({ length: qtyOf(r.cells) }, () => ({ done: false, note: "" })) }])));
          setDirty(true);
          setResetOpen(false);
        }}
      />
      <ConfirmDialog
        open={deleteTransport !== null}
        onOpenChange={(o) => !o && setDeleteTransport(null)}
        title={`Delete transport ${deleteTransport !== null ? String(deleteTransport + 1).padStart(3, "0") : ""}?`}
        description="This removes the transport row. It is only saved when you press Save."
        onConfirm={() => {
          if (deleteTransport === null) return;
          setTransport((r) => r.filter((_, j) => j !== deleteTransport));
          setDirty(true);
          setDeleteTransport(null);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-grey-100 bg-white px-5 py-3 shadow-sm">
        <div className="flex min-w-60 flex-1 items-center gap-3">
          <span className="font-heading text-base font-semibold text-grey-900">Components</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-grey-100">
            <div className="h-full rounded-full bg-success" style={{ width: `${totalQty ? Math.round((totalPacked / totalQty) * 100) : 0}%` }} />
          </div>
          <span className="font-number text-sm text-grey-700">{totalPacked} / {totalQty} {isProd ? "produced" : "packed"}</span>
        </div>
        <div className="flex items-center gap-1">
          {([["all", "All", totalQty], ["pending", "Pending", totalQty - totalPacked], ["completed", "Completed", totalPacked]] as const).map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === k ? "border-primary bg-primary-transparent text-primary" : "border-grey-100 bg-card text-grey-600 hover:bg-light-600"}`}
            >
              {label} <span className="font-number">({n})</span>
            </button>
          ))}
        </div>
        {!isProd && (
          <Button type="button" size="sm" disabled={totalPacked === 0} onClick={finishBox}>
            <Check className="h-4 w-4" /> Finish box
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={totalPacked === 0} onClick={() => setResetOpen(true)}>
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-grey-100 bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-[12px] font-body">
          <thead className="bg-light-600 uppercase text-grey-900">
            <tr>
              {shown.map(({ h }) => <th key={h} className="whitespace-nowrap border border-grey-100 px-2 py-2 font-semibold">{h}</th>)}
              {isProd ? <th className="border border-grey-100 px-2 py-2 font-semibold">Produced</th> : (
              <th className="border border-grey-100 px-2 py-2 font-semibold">
                <div>Packing Box</div>
                <div className="mt-1 flex items-center gap-1 normal-case">
                  <select value={slipPick} onChange={(e) => { setSlipPick(e.target.value); setBoxPick(""); }} aria-label="Filter by packing slip" className="h-7 rounded-md border border-grey-100 bg-card px-1.5 text-[11px] font-normal text-grey-800 outline-none focus:border-primary">
                    <option value="">All slips</option>
                    {transport.map((_, i) => <option key={i} value={String(i)}>{psLabel(po.poNumber, i)}</option>)}
                  </select>
                  <select value={boxPick} onChange={(e) => setBoxPick(e.target.value)} aria-label="Filter by box number" className="h-7 rounded-md border border-grey-100 bg-card px-1.5 text-[11px] font-normal text-grey-800 outline-none focus:border-primary">
                    <option value="">All boxes</option>
                    {boxNumbers.map((n) => <option key={n} value={String(n)}>Box {n}</option>)}
                  </select>
                </div>
              </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ key, cells }, idx) => {
              const qty = qtyOf(cells);
              const pieces = piecesOf(key, qty);
              const full = qty > 0 && pieces.every((x) => x.done);
              // A new cabinet (the whole-number part of Sr) starts after a small gap.
              const cab = String(cells[0]).split(".")[0];
              const newCab = idx > 0 && String(visibleRows[idx - 1].cells[0]).split(".")[0] !== cab;
              return (
                <Fragment key={key}>
                {newCab && <tr aria-hidden><td colSpan={shown.length + 1} className="h-4 bg-light-600 p-0" /></tr>}
                <tr className={`align-top text-grey-800 ${full ? "bg-success-transparent" : ""}`}>
                  {shown.map(({ h, i }) => (
                    <td key={h} className="whitespace-nowrap border border-grey-100 px-2 py-1.5 font-number">{cells[i]}</td>
                  ))}
                  <td className="border border-grey-100 px-2 py-1">
                    <div className="flex flex-col gap-1">
                      {pieces.map((pc, k) => ({ pc, k })).filter(({ pc }) => matches(pc)).map(({ pc, k }) => (
                        <div key={k} className="flex items-center gap-2">
                          <input type="checkbox" aria-label={`Piece ${k + 1} of row ${cells[0]} ${isProd ? "produced" : "packed"}`} checked={pc.done} onChange={(e) => setPiece(key, qty, k, { done: e.target.checked })} className="h-4 w-4 accent-primary" />
                          {!isProd && pc.done && pc.seq ? <span className="whitespace-nowrap text-center font-number text-[11px] font-semibold text-primary">{pc.seq} · {psLabel(po.poNumber, pc.tr ?? 0)}</span> : null}
                          {pc.done && <Input value={pc.note} onFocus={() => { if (!isProd && !pc.seq) numberGroup(); }} onChange={(e) => (isProd ? setPiece(key, qty, k, { note: e.target.value }) : shareNote(pc.seq, pc.tr, e.target.value))} placeholder="Note" className="h-7 min-w-48 text-xs" />}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
                </Fragment>
              );
            })}
            {visibleRows.length === 0 && (
              <tr><td colSpan={shown.length + 1} className="px-3 py-6 text-center text-grey-400">{rows.length === 0 ? "This invoice has no component rows yet." : filter === "pending" ? (isProd ? "Everything is produced." : "Everything is packed.") : isProd ? "Nothing is produced yet." : "Nothing is packed yet."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
