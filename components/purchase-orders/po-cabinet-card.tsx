"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PoLinesTable } from "@/components/purchase-orders/po-lines-table";
import { formatInr } from "@/lib/format";
import { recalcCarcass } from "@/lib/purchase-order-from-quote";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { PO_GROUPS, lineAmount, type PoCabinet, type PurchaseOrderLine } from "@/lib/purchase-order";

// One cabinet of the quote: header (number, unit/cabinet name, W/D/H/Qty) and its components
// underneath, grouped Carcass / Shutter / Other Panel / Hardware — the same flow as the quote.
// W/D/H/Qty start as the quote's cabinet size and are editable; the rows are snapshots, so they only
// change when you press Auto Populate (same as the quote: carcass rows only, from the cabinet type's formulas).
const dimInput =
  "h-8 w-16 rounded-md border border-grey-100 bg-card px-2 text-right text-sm font-number text-grey-900 outline-none focus:border-primary";
export function PoCabinetCard({
  srNo,
  lines,
  cabinet,
  onCabinetChange,
  onChange,
}: {
  srNo: number;
  lines: PurchaseOrderLine[];
  cabinet?: PoCabinet;
  onCabinetChange: (cabinet: PoCabinet) => void;
  onChange: (lines: PurchaseOrderLine[]) => void;
}) {
  // Collapsed by default: a PO can have dozens of cabinets, so open only the ones you need.
  const [collapsed, setCollapsed] = useState(true);
  const mine = lines.filter((l) => l.srNo === srNo);
  const designType = mine[0]?.designType ?? "";
  const total = mine.reduce((s, l) => s + lineAmount(l), 0);

  const cabinetType = useCabinetTypes().find((t) => t.id === cabinet?.cabinetTypeId);

  // Recalculate the sizes of this cabinet's existing carcass rows for the W/D/H/Qty in the header.
  // Rows are never added or removed, and rate / remarks / finishes stay as typed.
  const autoPopulate = () => {
    if (!cabinet || !cabinetType) return;
    const mineCarcass = lines.filter((l) => l.srNo === srNo && l.group === "carcass");
    const { lines: next, recalculated } = recalcCarcass({ cabinetType, cabinet, lines: mineCarcass, materials: materialSpecStore.getSnapshot() });
    const byId = new Map(next.map((l) => [l.id, l]));
    onChange(lines.map((l) => byId.get(l.id) ?? l));
    const skipped = mineCarcass.length - recalculated;
    toastStore.show(
      `Cabinet ${srNo}: ${recalculated} carcass row${recalculated === 1 ? "" : "s"} recalculated${skipped > 0 ? `, ${skipped} not in the cabinet type left as they are` : ""}`,
      "success"
    );
  };

  const name = [cabinet?.unitName, cabinet?.label].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-grey-100 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={`${collapsed ? "Expand" : "Collapse"} cabinet ${srNo}`}
          aria-expanded={!collapsed}
          className="flex min-w-0 items-center gap-2 text-left hover:text-primary"
        >
          {collapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-grey-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-grey-500" />}
          <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary-transparent px-1.5 font-number text-sm font-semibold text-primary">{srNo}</span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-heading text-base font-semibold text-grey-900">
              {name || `Cabinet ${srNo}`}
              {designType && <span className="ml-2 font-number text-sm font-normal text-grey-500">{designType}</span>}
            </span>
            {cabinet?.space && <span className="text-xs font-body text-grey-500">{cabinet.space}</span>}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-body text-grey-700">
          {cabinet && (
            <div className="flex flex-wrap items-center gap-2">
              {(["width", "depth", "height", "qty"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1 text-xs text-grey-500">
                  {k === "qty" ? "Qty" : k[0].toUpperCase()}
                  <input
                    type="number"
                    min={k === "qty" ? 1 : 0}
                    aria-label={`Cabinet ${srNo} ${k}`}
                    className={dimInput}
                    value={cabinet[k]}
                    onChange={(e) => onCabinetChange({ ...cabinet, [k]: e.target.value === "" ? 0 : Number(e.target.value) })}
                  />
                </label>
              ))}
              <Button
                type="button"
                size="sm"
                disabled={!cabinetType}
                title={cabinetType ? "Recalculate this cabinet's carcass sizes from its W / D / H" : "This cabinet's type isn't available (older PO or deleted type)"}
                onClick={autoPopulate}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Auto Populate
              </Button>
            </div>
          )}
          <span className="font-number font-semibold text-grey-900">{formatInr(total)}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {PO_GROUPS.filter((g) => mine.some((l) => l.group === g.key)).map((g) => (
            <PoLinesTable
              key={g.key}
              group={g.key}
              title={g.label}
              lines={lines}
              srNo={srNo}
              vars={cabinet ? { W: cabinet.width, D: cabinet.depth, H: cabinet.height } : undefined}
              onChange={onChange}
            />
          ))}
        </>
      )}
    </div>
  );
}
