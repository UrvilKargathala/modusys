"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PoCabinetNameField, PoCabinetNameSelect } from "@/components/purchase-orders/po-design-select";
import { PoFinishSelect } from "@/components/purchase-orders/po-finish-select";
import { PoRawMaterialSelect } from "@/components/purchase-orders/po-raw-material-select";
import { PoLinesTable, newBlankLine } from "@/components/purchase-orders/po-lines-table";
import { formatInr } from "@/lib/format";
import { recalcCarcass } from "@/lib/purchase-order-from-quote";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { PO_GROUPS, lineAmount, mostUsed, type PoCabinet, type PurchaseOrderLine } from "@/lib/purchase-order";

// One cabinet of the quote: header (number, unit/cabinet name, W/D/H/Qty) and its components
// underneath, grouped Carcass / Shutter / Other Panel / Hardware — the same flow as the quote.
// W/D/H/Qty start as the quote's cabinet size and are editable; the rows are snapshots, so they only
// change when you press Auto Populate (same as the quote: carcass rows only, from the cabinet type's formulas).
// A form field with its label above it.
const fieldInput = "h-9 w-full rounded-lg border border-grey-100 bg-card px-2 text-[13px] font-body text-grey-900 outline-none focus:border-primary";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-grey-500">
      {label}
      {children}
    </label>
  );
}

export function PoCabinetCard({
  srNo,
  lines,
  cabinet,
  onCabinetChange,
  onChange,
  onRemove,
}: {
  srNo: number;
  lines: PurchaseOrderLine[];
  cabinet?: PoCabinet;
  onCabinetChange: (cabinet: PoCabinet) => void;
  onChange: (lines: PurchaseOrderLine[]) => void;
  onRemove: () => void;
}) {
  const mine = lines.filter((l) => l.srNo === srNo);
  // Collapsed by default: a PO can have dozens of cabinets, so open only the ones you need.
  // A cabinet with no rows yet (just added by hand) starts open so you can fill it.
  const [collapsed, setCollapsed] = useState(mine.length > 0);
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

  // A cabinet added by hand (not from a quote) has no unit or cabinet type: its name is typed in, and it has no Auto Populate.
  const isManual = !!cabinet && !cabinet.unitName && !cabinet.cabinetTypeId;
  const emptyGroups = PO_GROUPS.filter((g) => !mine.some((l) => l.group === g.key));

  const name = cabinet?.label;
  // This cabinet's internal / external brand & colour and material, applied to all its carcass rows (same as By component).
  const carcassRows = mine.filter((l) => l.group === "carcass");
  const commonCarcass = (k: "internalColour" | "externalColour" | "material") =>
    mostUsed(carcassRows.map((l) => l[k]));
  const applyCarcass = (fields: Partial<PurchaseOrderLine>) =>
    onChange(lines.map((l) => (l.srNo === srNo && l.group === "carcass" ? { ...l, ...fields } : l)));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-grey-100 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isManual && cabinet ? (
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={`${collapsed ? "Expand" : "Collapse"} cabinet ${srNo}`}
              aria-expanded={!collapsed}
              className="flex items-center gap-2 hover:text-primary"
            >
              {collapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-grey-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-grey-500" />}
              <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary-transparent px-1.5 font-number text-sm font-semibold text-primary">{srNo}</span>
            </button>
            <input
              aria-label={`Cabinet ${srNo} name`}
              placeholder="Cabinet name, e.g. Base Unit"
              className="h-8 w-72 rounded-md border border-grey-100 bg-card px-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
              value={cabinet.label}
              onChange={(e) => onCabinetChange({ ...cabinet, label: e.target.value })}
            />
          </div>
        ) : (
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
              {cabinet?.unitName || name || `Cabinet ${srNo}`}
              {designType && <span className="ml-2 font-number text-sm font-normal text-grey-500">{designType}</span>}
            </span>
            {cabinet?.space && <span className="text-xs font-body text-grey-500">{cabinet.space}</span>}
          </span>
        </button>
        )}
        <div className="flex items-center gap-3">
          <span className="font-number text-base font-semibold text-grey-900">{formatInr(total)}</span>
          {cabinet && !isManual && (
            <Button
              type="button"
              size="icon-sm"
              aria-label="Auto Populate"
              disabled={!cabinetType}
              title={cabinetType ? "Auto Populate: recalculate this cabinet's carcass sizes from its W / D / H" : "This cabinet's type isn't available (older PO or deleted type)"}
              onClick={autoPopulate}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {cabinet && (
        <div className="grid grid-cols-2 gap-3 pl-8 md:grid-cols-4 lg:grid-cols-[2fr_2fr_repeat(4,1fr)_2fr_3fr]">
          <Field label="Cabinet Type">
            <PoCabinetNameSelect field value={cabinet.designType ?? ""} fallback={cabinet.label} onChange={(v, cabinetTypeId) => onCabinetChange({ ...cabinet, designType: v, cabinetTypeId })} />
          </Field>
          <Field label="Cabinet Name">
            <PoCabinetNameField stacked value={cabinet.cabinetName ?? ""} onChange={(v) => onCabinetChange({ ...cabinet, cabinetName: v })} />
          </Field>
          {(["width", "depth", "height", "qty"] as const).map((k) => (
            <Field key={k} label={k === "qty" ? "Qty" : k === "width" ? "W" : k === "depth" ? "D" : "H"}>
              <input
                type="number"
                min={k === "qty" ? 1 : 0}
                aria-label={`Cabinet ${srNo} ${k}`}
                className={fieldInput + " text-right font-number"}
                value={cabinet[k]}
                onChange={(e) => onCabinetChange({ ...cabinet, [k]: e.target.value === "" ? 0 : Number(e.target.value) })}
              />
            </Field>
          ))}
          <Field label="Design">
            <input aria-label={`Cabinet ${srNo} design`} className={fieldInput} value={cabinet.design ?? ""} onChange={(e) => onCabinetChange({ ...cabinet, design: e.target.value })} />
          </Field>
          <Field label="Remark">
            <input aria-label={`Cabinet ${srNo} remark`} className={fieldInput} value={cabinet.remark ?? ""} onChange={(e) => onCabinetChange({ ...cabinet, remark: e.target.value })} />
          </Field>
        </div>
      )}

      {mine.some((l) => l.group === "carcass") && (
        <div className="grid grid-cols-1 gap-3 pl-8 md:grid-cols-3">
          <Field label="Internal Brand & Colour">
            <PoFinishSelect kind="internal" value={commonCarcass("internalColour")} onChange={(v) => applyCarcass({ internalColour: v })} />
          </Field>
          <Field label="External Brand & Colour">
            <PoFinishSelect kind="external" value={commonCarcass("externalColour")} onChange={(v) => applyCarcass({ externalColour: v })} />
          </Field>
          <Field label="Material">
            <PoRawMaterialSelect value={commonCarcass("material")} onChange={(v) => applyCarcass({ material: v })} />
          </Field>
        </div>
      )}

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
          <div className="flex flex-wrap items-center gap-2">
            {emptyGroups.length > 0 && <span className="text-xs font-body text-grey-500">Add rows:</span>}
            {emptyGroups.map((g) => (
              <Button key={g.key} type="button" variant="outline" size="sm" onClick={() => onChange([...lines, newBlankLine(g.key, srNo, designType, lines.length)])}>
                <Plus className="h-3.5 w-3.5" />
                {g.label}
              </Button>
            ))}
            {mine.length === 0 && (
              <Button type="button" variant="outline" size="sm" className="ml-auto text-error" onClick={onRemove}>
                Remove cabinet
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
