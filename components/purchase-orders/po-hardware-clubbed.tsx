"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { formatInr } from "@/lib/format";
import { lineAmount, type PurchaseOrderLine } from "@/lib/purchase-order";

const cell =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm font-body text-grey-900 outline-none hover:border-grey-100 focus:border-primary focus:bg-card";
const th = "whitespace-nowrap px-2 py-2 text-xs font-body font-semibold uppercase tracking-wide text-grey-900";

// Hardware across all cabinets with repeated items clubbed into one row: same description, article no, brand,
// category and unit. Qty is the total; rate and remarks typed on a clubbed row are applied to every row behind it.
// The cabinet-by-cabinet rows are untouched (see By cabinet), so nothing is lost.
export function PoHardwareClubbed({ lines, onChange }: { lines: PurchaseOrderLine[]; onChange: (lines: PurchaseOrderLine[]) => void }) {
  const [collapsed, setCollapsed] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const key = (l: PurchaseOrderLine) => [l.description, l.articleNo, l.brand, l.category, l.unit].map((s) => s.trim().toLowerCase()).join("|");
  const groups: { key: string; rows: PurchaseOrderLine[] }[] = [];
  for (const l of lines.filter((x) => x.group === "hardware")) {
    const g = groups.find((x) => x.key === key(l));
    if (g) g.rows.push(l);
    else groups.push({ key: key(l), rows: [l] });
  }
  const total = groups.reduce((s, g) => s + g.rows.reduce((t, l) => t + lineAmount(l), 0), 0);
  const patch = (ids: Set<string>, fields: Partial<PurchaseOrderLine>) => onChange(lines.map((l) => (ids.has(l.id) ? { ...l, ...fields } : l)));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={`${collapsed ? "Expand" : "Collapse"} Hardware`}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 rounded-md text-left hover:text-primary"
        >
          {collapsed ? <ChevronRight className="h-4 w-4 text-grey-500" /> : <ChevronDown className="h-4 w-4 text-grey-500" />}
          <h3 className="font-heading text-base font-semibold text-grey-900">
            Hardware <span className="font-number text-sm font-normal text-grey-500">({groups.length})</span>
          </h3>
        </button>
        <span className="font-number text-sm text-grey-700">{formatInr(total)}</span>
      </div>
      {!collapsed && (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full min-w-max table-fixed text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                {["Sr", "Description", "Article No", "Brand", "Category", "Unit", "Qty", "Rate", "Amount", "Remarks"].map((h, i) => (
                  <th key={h} className={`${th} ${["w-20", "w-72", "w-40", "w-28", "w-36", "w-20", "w-16", "w-24", "w-28", "w-48"][i]} ${["Qty", "Rate", "Amount"].includes(h) ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => {
                const first = g.rows[0];
                const ids = new Set(g.rows.map((r) => r.id));
                const qty = g.rows.reduce((s, r) => s + r.qty, 0);
                const isOpen = open.has(g.key);
                return (
                  <Fragment key={g.key}>
                  <tr className="border-t border-grey-100">
                    <td className="px-2">
                      <button
                        type="button"
                        onClick={() => toggle(g.key)}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} item ${gi + 1}`}
                        aria-expanded={isOpen}
                        className="flex items-center gap-1 rounded-md font-number text-sm font-semibold text-grey-900 hover:text-primary"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4 text-grey-500" /> : <ChevronRight className="h-4 w-4 text-grey-500" />}
                        {gi + 1}
                      </button>
                    </td>
                    <td className="px-3 text-sm font-body text-grey-900">{first.description}</td>
                    <td className="px-3 font-number text-sm text-grey-900">{first.articleNo}</td>
                    <td className="px-3 text-sm font-body text-grey-900">{first.brand}</td>
                    <td className="px-3 text-sm font-body text-grey-900">{first.category}</td>
                    <td className="px-3 text-sm font-body text-grey-900">{first.unit}</td>
                    <td className="px-2 text-right font-number text-sm text-grey-900">{qty}</td>
                    <td className="px-1">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0"
                        className={`${cell} font-number text-right`}
                        value={first.rate === 0 ? "" : String(first.rate)}
                        onChange={(e) => patch(ids, { rate: e.target.value === "" ? 0 : Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 text-right font-number text-sm text-grey-900">{formatInr(g.rows.reduce((s, r) => s + lineAmount(r), 0))}</td>
                    <td className="px-1">
                      <input className={cell} value={first.remarks} onChange={(e) => patch(ids, { remarks: e.target.value })} />
                    </td>
                    <td className="px-1">
                      <button
                        type="button"
                        aria-label="Remove clubbed rows"
                        title="Remove this item from every cabinet"
                        onClick={() => onChange(lines.filter((l) => !ids.has(l.id)))}
                        className="rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {isOpen &&
                    g.rows.map((r, ri) => (
                      <tr key={r.id} className="border-t border-grey-100 bg-light-600">
                        <td className="px-2 pl-8 font-number text-sm text-grey-700">{`${gi + 1}.${ri + 1}`}</td>
                        <td className="px-3 text-sm font-body text-grey-500" colSpan={5}>{`Cabinet ${r.srNo}`}</td>
                        <td className="px-1">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            aria-label={`Cabinet ${r.srNo} qty`}
                            className={`${cell} font-number text-right`}
                            value={r.qty}
                            onChange={(e) => patch(new Set([r.id]), { qty: e.target.value === "" ? 0 : Number(e.target.value) })}
                          />
                        </td>
                        <td />
                        <td className="px-2 text-right font-number text-sm text-grey-700">{formatInr(lineAmount(r))}</td>
                        <td />
                        <td className="px-1">
                          <button
                            type="button"
                            aria-label="Remove from this cabinet"
                            title="Remove from this cabinet"
                            onClick={() => onChange(lines.filter((l) => l.id !== r.id))}
                            className="rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
