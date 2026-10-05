"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PoLinesTable } from "@/components/purchase-orders/po-lines-table";
import { PoFinishSelect } from "@/components/purchase-orders/po-finish-select";
import { formatInr } from "@/lib/format";
import { PO_GROUPS, lineAmount, type PoCabinet, type PurchaseOrderLine } from "@/lib/purchase-order";

// One cabinet of the quote: header (number, unit/cabinet name, W/D/H) and its components
// underneath, grouped Carcass / Shutter / Other Panel / Hardware — the same flow as the quote.
// Header W/D/H are the quote's cabinet size at the time the PO was created (rows are snapshots).
export function PoCabinetCard({
  srNo,
  lines,
  cabinet,
  onChange,
}: {
  srNo: number;
  lines: PurchaseOrderLine[];
  cabinet?: PoCabinet;
  onChange: (lines: PurchaseOrderLine[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const mine = lines.filter((l) => l.srNo === srNo);
  const designType = mine[0]?.designType ?? "";
  const total = mine.reduce((s, l) => s + lineAmount(l), 0);

  // Shared finish for the cabinet's panel rows: shows the common value, "" when rows differ.
  const panels = mine.filter((l) => l.group !== "hardware");
  const common = (key: "internalColour" | "externalColour") => (panels.length > 0 && panels.every((l) => l[key] === panels[0][key]) ? panels[0][key] : "");
  const applyAll = (key: "internalColour" | "externalColour", label: string) =>
    onChange(lines.map((l) => (l.srNo === srNo && l.group !== "hardware" ? { ...l, [key]: label } : l)));

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
            <span className="font-number">
              W {cabinet.width} · D {cabinet.depth} · H {cabinet.height} · Qty {cabinet.qty}
            </span>
          )}
          <span className="font-number font-semibold text-grey-900">{formatInr(total)}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="grid gap-3 rounded-lg bg-light-600 p-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-body font-medium text-grey-500">Internal Brand & Colour — all panel rows</span>
              <PoFinishSelect kind="internal" value={common("internalColour")} onChange={(label) => applyAll("internalColour", label)} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-body font-medium text-grey-500">External Brand & Colour — all panel rows</span>
              <PoFinishSelect kind="external" value={common("externalColour")} onChange={(label) => applyAll("externalColour", label)} />
            </div>
          </div>
          {PO_GROUPS.filter((g) => mine.some((l) => l.group === g.key)).map((g) => (
            <PoLinesTable key={g.key} group={g.key} title={g.label} lines={lines} srNo={srNo} onChange={onChange} />
          ))}
        </>
      )}
    </div>
  );
}
