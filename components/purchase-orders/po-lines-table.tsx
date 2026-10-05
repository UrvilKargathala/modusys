"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/format";
import { lineAmount, panelSqft, type PoGroup, type PurchaseOrderLine } from "@/lib/purchase-order";

const cell =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm font-body text-grey-900 outline-none hover:border-grey-100 focus:border-primary focus:bg-card";
const numCell = `${cell} font-number text-right`;
const th = "whitespace-nowrap px-2 py-2 text-xs font-body font-semibold uppercase tracking-wide text-grey-900";

type Col = { key: string; label: string; width: string };

const PANEL_COLS: Col[] = [
  { key: "srNo", label: "Sr", width: "w-14" },
  { key: "description", label: "Description", width: "w-48" },
  { key: "designType", label: "Design", width: "w-24" },
  { key: "width", label: "Width", width: "w-20" },
  { key: "depth", label: "Thk", width: "w-16" },
  { key: "height", label: "Height", width: "w-20" },
  { key: "qty", label: "Qty", width: "w-16" },
  { key: "sqft", label: "Sq.Ft", width: "w-20" },
  { key: "internalColour", label: "Internal", width: "w-40" },
  { key: "externalColour", label: "External", width: "w-40" },
  { key: "material", label: "Material", width: "w-28" },
  { key: "rate", label: "Rate", width: "w-24" },
  { key: "amount", label: "Amount", width: "w-28" },
  { key: "remarks", label: "Remarks", width: "w-48" },
];

const HW_COLS: Col[] = [
  { key: "srNo", label: "Sr", width: "w-14" },
  { key: "description", label: "Description", width: "w-56" },
  { key: "designType", label: "Design", width: "w-24" },
  { key: "articleNo", label: "Article No", width: "w-32" },
  { key: "brand", label: "Brand", width: "w-28" },
  { key: "category", label: "Category", width: "w-28" },
  { key: "unit", label: "Unit", width: "w-20" },
  { key: "qty", label: "Qty", width: "w-16" },
  { key: "rate", label: "Rate", width: "w-24" },
  { key: "amount", label: "Amount", width: "w-28" },
  { key: "remarks", label: "Remarks", width: "w-48" },
];

const TEXT_KEYS = new Set(["description", "designType", "internalColour", "externalColour", "material", "articleNo", "brand", "category", "unit", "remarks"]);

export function PoLinesTable({
  group,
  title,
  lines,
  onChange,
}: {
  group: PoGroup;
  title: string;
  lines: PurchaseOrderLine[];
  onChange: (lines: PurchaseOrderLine[]) => void;
}) {
  const hardware = group === "hardware";
  const cols = hardware ? HW_COLS : PANEL_COLS;
  const mine = lines.filter((l) => l.group === group);
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
  const add = () =>
    onChange([
      ...lines,
      {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        group,
        srNo: mine[mine.length - 1]?.srNo ?? 0,
        position: lines.length,
        description: "", designType: "", width: 0, depth: 0, height: 0, qty: 1, sqft: 0,
        internalColour: "", externalColour: "", material: "", articleNo: "", brand: "", category: "", unit: "", rate: 0, remarks: "",
      },
    ]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold text-grey-900">
          {title} <span className="font-number text-sm font-normal text-grey-500">({mine.length})</span>
        </h3>
        <div className="flex items-center gap-3">
          <span className="font-number text-sm text-grey-700">{formatInr(total)}</span>
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </Button>
        </div>
      </div>
      {mine.length === 0 ? (
        <p className="rounded-lg border border-dashed border-grey-100 py-4 text-center text-sm font-body text-grey-400">No rows</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className={`${th} ${c.width} ${["width", "depth", "height", "qty", "sqft", "rate", "amount"].includes(c.key) ? "text-right" : ""}`}>
                    {c.label}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {mine.map((l) => (
                <tr key={l.id} className="border-t border-grey-100">
                  {cols.map((c) => (
                    <td key={c.key} className="px-1 py-1">
                      {c.key === "amount" ? (
                        <span className="block px-2 text-right font-number text-sm text-grey-900">{formatInr(lineAmount(l))}</span>
                      ) : c.key === "sqft" ? (
                        <span className="block px-2 text-right font-number text-sm text-grey-700">{l.sqft.toFixed(2)}</span>
                      ) : TEXT_KEYS.has(c.key) ? (
                        <input
                          className={cell}
                          value={String(l[c.key as keyof PurchaseOrderLine] ?? "")}
                          onChange={(e) => patch(l.id, { [c.key]: e.target.value })}
                        />
                      ) : (
                        <input
                          type="number"
                          className={numCell}
                          min={0}
                          step="any"
                          placeholder={c.key === "rate" ? "0" : undefined}
                          value={Number(l[c.key as keyof PurchaseOrderLine]) === 0 && c.key === "rate" ? "" : String(l[c.key as keyof PurchaseOrderLine])}
                          onChange={(e) => patch(l.id, { [c.key]: e.target.value === "" ? 0 : Number(e.target.value) })}
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-1">
                    <button
                      type="button"
                      aria-label="Remove row"
                      onClick={() => onChange(lines.filter((x) => x.id !== l.id))}
                      className="rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error"
                    >
                      <X className="h-4 w-4" />
                    </button>
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
