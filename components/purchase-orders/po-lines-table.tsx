"use client";

import { Fragment, createContext, useContext, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Copy, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatInr } from "@/lib/format";
import { PoHardwareSelect } from "@/components/purchase-orders/po-hardware-select";
import { PoRawMaterialSelect } from "@/components/purchase-orders/po-raw-material-select";
import { PoFinishSelect } from "@/components/purchase-orders/po-finish-select";
import { evaluateFormula } from "@/lib/quote-pricing";
import { toastStore } from "@/lib/store/toast-store";
import { PurchaseFurniturePriceFormDialog } from "@/components/templates/purchase-furniture-price-form-dialog";
import { purchasePriceFieldsFor } from "@/lib/purchase-order-rate";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { purchaseFurnitureStore, type NewPurchaseFurnitureInput } from "@/lib/store/purchase-furniture-store";
import { lineAmount, panelSqft, type PoGroup, type PurchaseOrderLine } from "@/lib/purchase-order";

// The PO's vendor, so "Add this combination" can tag the new price with it.
// Vendor for a cabinet's rows: the cabinet's own vendor, else the PO's.
export const PoVendorContext = createContext<(srNo: number) => string>(() => "");
// Hardware row's vendor name, from the Vendor tab's brand → vendor setting.
export const PoBrandVendorContext = createContext<(brand: string) => string>(() => "");

const cell =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm font-body text-grey-900 outline-none hover:border-grey-100 focus:border-primary focus:bg-card";
const numCell = `${cell} font-number text-right`;
const th = "whitespace-nowrap px-2 py-2 text-xs font-body font-semibold uppercase tracking-wide text-grey-900";

type Col = { key: string; label: string; width: string };

const PANEL_COLS: Col[] = [
  { key: "srNo", label: "Sr", width: "w-16" },
  { key: "description", label: "Description", width: "w-72" },
  { key: "designType", label: "Design", width: "w-36" },
  { key: "width", label: "Width", width: "w-20" },
  { key: "depth", label: "Thk", width: "w-20" },
  { key: "height", label: "Height", width: "w-20" },
  { key: "qty", label: "Qty", width: "w-16" },
  { key: "sqft", label: "Sq.Ft", width: "w-20" },
  { key: "internalColour", label: "Internal Brand & Colour", width: "w-56" },
  { key: "externalColour", label: "External Brand & Colour", width: "w-56" },
  { key: "material", label: "Material", width: "w-40" },
  { key: "rate", label: "Rate", width: "w-24" },
  { key: "amount", label: "Amount", width: "w-28" },
  { key: "remarks", label: "Remarks", width: "w-48" },
];

const HW_COLS: Col[] = [
  { key: "srNo", label: "Sr", width: "w-16" },
  { key: "brand", label: "Brand", width: "w-28" },
  { key: "vendor", label: "Vendor", width: "w-40" },
  { key: "description", label: "Description", width: "w-72" },
  { key: "designType", label: "Design", width: "w-36" },
  { key: "articleNo", label: "Article No", width: "w-40" },
  { key: "category", label: "Category", width: "w-36" },
  { key: "unit", label: "Unit", width: "w-20" },
  { key: "qty", label: "Qty", width: "w-16" },
  { key: "rate", label: "MRP", width: "w-28" },
  { key: "discountPct", label: "Discount %", width: "w-24" },
  { key: "netRate", label: "Rate", width: "w-28" },
  { key: "amount", label: "Amount", width: "w-28" },
  { key: "remarks", label: "Remarks", width: "w-48" },
];

const TEXT_KEYS = new Set(["description", "designType", "internalColour", "externalColour", "material", "articleNo", "brand", "category", "unit", "remarks"]);

// A new empty row for a group, in the given cabinet.
export function newBlankLine(group: PoGroup, srNo: number, designType: string, position: number): PurchaseOrderLine {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    group,
    srNo,
    position,
    description: "", designType, width: 0, depth: 0, height: 0, qty: 1, sqft: 0,
    internalColour: "", externalColour: "", material: "", articleNo: "", brand: "", category: "", unit: "", rate: 0, remarks: "",
  };
}

type Vars = { W: number; D: number; H: number };

// Number cell that also takes a formula in the cabinet's W / D / H ("w-10", "(D-20)/2"; upper or lower case).
// It collapses to the result when you tab out or press Enter, like the quote's width/height fields. Plain numbers
// are kept as typed; a formula that can't be read puts the old value back and says why.
// Rate shown with 2 decimals (250.00); free typing while focused, saved on blur. Empty / 0 = no rate (red).
function RateCell({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      type="number"
      min={0}
      step="any"
      placeholder="0.00"
      className={value ? numCell : `${numCell} rounded-md bg-card text-error ring-1 ring-error-300 placeholder:text-error`}
      value={text ?? (value ? value.toFixed(2) : "")}
      onFocus={() => setText(value ? String(value) : "")}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== null) onCommit(text.trim() === "" ? 0 : Number(text));
        setText(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function DimCell({ value, vars, onCommit }: { value: number; vars?: Vars; onCommit: (n: number) => void }) {
  const [text, setText] = useState<string | null>(null); // null = not editing

  const commit = () => {
    if (text === null) return;
    const t = text.trim();
    setText(null);
    if (t === "") return onCommit(0);
    if (/^\d*\.?\d+$/.test(t)) return onCommit(Number(t));
    if (!vars) return toastStore.show("This purchase order has no cabinet size to use in a formula — type a number.", "error");
    const n = Math.round(evaluateFormula(t, vars));
    if (/[WDH]/i.test(t) && n > 0) return onCommit(n);
    toastStore.show(`Couldn't read "${t}" — use numbers or W, D, H, like W-10 or (D-20)/2.`, "error");
  };

  return (
    <input
      className={numCell}
      inputMode="text"
      autoComplete="off"
      value={text ?? (value === 0 ? "" : String(value))}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      title={vars ? `W ${vars.W} · D ${vars.D} · H ${vars.H} — type e.g. W-10, then Tab` : undefined}
    />
  );
}

// srNo given = shown inside that cabinet's card: only its rows, and the Sr / Design columns
// are dropped (the cabinet header already shows them).
export function PoLinesTable({
  group,
  title,
  lines,
  srNo,
  vars,
  varsFor,
  header,
  subHeader,
  defaultCollapsed = false,
  only,
  onChange,
}: {
  group: PoGroup;
  title: string;
  lines: PurchaseOrderLine[];
  srNo?: number;
  // The cabinet's W / D / H, for formulas typed in Width / Height (and hardware Qty).
  vars?: Vars;
  // When the table spans all cabinets: each row's own cabinet W / D / H.
  varsFor?: (srNo: number) => Vars | undefined;
  // Replaces the title (e.g. a cabinet's name and W / D / H / Qty).
  header?: ReactNode;
  // A second line under the header (e.g. the cabinet's size and details).
  subHeader?: ReactNode;
  // Start closed; the user opens what they need.
  defaultCollapsed?: boolean;
  // Show only these rows (e.g. Rate pending); hides Add Row.
  only?: (l: PurchaseOrderLine) => boolean;
  onChange: (lines: PurchaseOrderLine[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // Removing a row asks first.
  const [toRemove, setToRemove] = useState<PurchaseOrderLine | null>(null);
  // A panel row with no price: add its combination to the Purchase Furniture Price List (only the rate to type).
  const vendorFor = useContext(PoVendorContext);
  const brandVendor = useContext(PoBrandVendorContext);
  const [pricePrefill, setPricePrefill] = useState<Partial<NewPurchaseFurnitureInput> | null>(null);
  const hardware = group === "hardware";
  const cols = (hardware ? HW_COLS : PANEL_COLS).filter((c) => srNo === undefined || c.key !== "designType");
  const mine = lines.filter((l) => l.group === group && (srNo === undefined || l.srNo === srNo) && (!only || only(l)));
  const total = mine.reduce((s, l) => s + lineAmount(l), 0);

  const patch = (id: string, fields: Partial<PurchaseOrderLine>) =>
    onChange(
      lines.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...fields };
        // Panel area follows its own width/height/qty (same maths as the quote).
        return hardware ? next : { ...next, sqft: panelSqft(next.width, next.height, next.qty) };
      })
    );
  // Copy a row: same values, new id, placed right under the original.
  const copyRow = (l: PurchaseOrderLine) => {
    const at = lines.findIndex((x) => x.id === l.id);
    const clone = { ...l, id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    onChange([...lines.slice(0, at + 1), clone, ...lines.slice(at + 1)].map((x, i) => ({ ...x, position: i })));
  };
  const add = () => {
    setCollapsed(false);
    const no = srNo ?? mine[mine.length - 1]?.srNo ?? 0;
    onChange([...lines, newBlankLine(group, no, srNo === undefined ? "" : (lines.find((l) => l.srNo === srNo)?.designType ?? ""), lines.length)]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 rounded-md text-left hover:text-primary"
        >
          {collapsed ? <ChevronRight className="h-4 w-4 text-grey-500" /> : <ChevronDown className="h-4 w-4 text-grey-500" />}
          {!header && (
            <h3 className="font-heading text-base font-semibold text-grey-900">
              {title} <span className="font-number text-sm font-normal text-grey-500">({mine.length})</span>
            </h3>
          )}
        </button>
        {header}
        <div className="flex items-center gap-3">
          <span className="font-number text-sm text-grey-700">{formatInr(total)}</span>
          {!only && (
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </Button>
          )}
        </div>
      </div>
      {subHeader}
      {collapsed ? null : mine.length === 0 ? (
        <p className="rounded-lg border border-dashed border-grey-100 py-4 text-center text-sm font-body text-grey-400">No rows</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full min-w-max table-fixed text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className={`${th} ${c.width} ${["width", "depth", "height", "qty", "sqft", "rate", "discountPct", "netRate", "amount"].includes(c.key) ? "text-right" : ""}`}>
                    {c.label}
                  </th>
                ))}
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {mine.map((l) => (
                <Fragment key={l.id}>
                <tr className={`border-t border-grey-100 ${l.rate ? "" : "bg-error-200"}`} title={l.rate ? undefined : "No rate for this row: none in the price list for this vendor. Type one in."}>
                  {cols.map((c) => (
                    <td key={c.key} className="px-1 py-1">
                      {c.key === "vendor" ? (
                        <span className="block truncate px-2 text-sm text-grey-700" title="Set in the Vendor tab">{brandVendor(l.brand) || "—"}</span>
                      ) : c.key === "netRate" ? (
                        <span className="block px-2 text-right font-number text-sm text-grey-900">{formatInr(l.rate * (1 - (l.discountPct ?? 0) / 100))}</span>
                      ) : c.key === "srNo" ? (
                        <span className="block px-2 font-number text-sm text-grey-900">{`${l.srNo}.${mine.filter((x) => x.srNo === l.srNo).indexOf(l) + 1}`}</span>
                      ) : c.key === "amount" ? (
                        <span className="block px-2 text-right font-number text-sm text-grey-900">{formatInr(lineAmount(l))}</span>
                      ) : c.key === "sqft" ? (
                        <span className="block px-2 text-right font-number text-sm text-grey-700">{l.sqft.toFixed(2)}</span>
                      ) : c.key === "internalColour" || c.key === "externalColour" ? (
                        <PoFinishSelect
                          kind={c.key === "internalColour" ? "internal" : "external"}
                          value={l[c.key]}
                          onChange={(label) => patch(l.id, { [c.key]: label })}
                        />
                      ) : hardware && (c.key === "brand" || c.key === "category" || c.key === "description" || c.key === "articleNo") ? (
                        <PoHardwareSelect field={c.key} line={l} onChange={(fields) => patch(l.id, fields)} />
                      ) : c.key === "description" ? (
                        <PoRawMaterialSelect compact category="furniture-component" value={l.description} onChange={(name) => patch(l.id, { description: name })} />
                      ) : c.key === "material" && !hardware ? (
                        <PoRawMaterialSelect compact value={l.material} onChange={(name) => patch(l.id, { material: name })} />
                      ) : TEXT_KEYS.has(c.key) ? (
                        <input
                          className={cell}
                          value={String(l[c.key as keyof PurchaseOrderLine] ?? "")}
                          onChange={(e) => patch(l.id, { [c.key]: e.target.value })}
                        />
                      ) : c.key === "rate" ? (
                        <RateCell value={l.rate} onCommit={(n) => patch(l.id, { rate: n })} />
                      ) : c.key === "width" || c.key === "height" || (hardware && c.key === "qty") ? (
                        <DimCell value={l[c.key]} vars={vars ?? varsFor?.(l.srNo)} onCommit={(n) => patch(l.id, { [c.key]: n })} />
                      ) : (
                        <input
                          type="number"
                          className={numCell}
                          min={0}
                          step="any"
                          placeholder={c.key === "rate" || c.key === "discountPct" ? "0" : undefined}
                          value={Number(l[c.key as keyof PurchaseOrderLine] ?? 0) === 0 && (c.key === "rate" || c.key === "discountPct") ? "" : String(l[c.key as keyof PurchaseOrderLine] ?? "")}
                          onChange={(e) => patch(l.id, { [c.key]: e.target.value === "" ? 0 : Number(e.target.value) })}
                        />
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-1">
                    <button
                      type="button"
                      aria-label="Copy row"
                      title="Copy row"
                      onClick={() => copyRow(l)}
                      className="rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-primary"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove row"
                      onClick={() => setToRemove(l)}
                      className="rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
                {!hardware && !l.rate && (
                  <tr className="bg-error-transparent">
                    <td colSpan={cols.length + 1} className="px-3 py-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-body text-error">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4" />
                          No price found for this combination.
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPricePrefill({ ...purchasePriceFieldsFor(l, materialSpecStore.getSnapshot()), vendorId: vendorFor(l.srNo) })}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add this combination to Purchase Furniture Price List
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PurchaseFurniturePriceFormDialog
        open={!!pricePrefill}
        onOpenChange={(o) => !o && setPricePrefill(null)}
        prefill={pricePrefill ?? undefined}
        onSubmit={(values) => purchaseFurnitureStore.create(values)}
      />
      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        title="Delete this row?"
        description={toRemove ? `"${toRemove.description || "Untitled row"}" (cabinet ${toRemove.srNo}) will be removed from this purchase order. Nothing is saved until you press Save.` : ""}
        onConfirm={() => {
          if (toRemove) onChange(lines.filter((x) => x.id !== toRemove.id));
          setToRemove(null);
        }}
      />
    </div>
  );
}
