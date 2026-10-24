"use client";

import { useContext } from "react";
import { ChevronDown, ChevronRight, Copy, Plus, Sparkles } from "lucide-react";
import { PoComponentsToggle } from "@/components/purchase-orders/po-components-toggle";
import { PoCabinetNameField, PoCabinetNameSelect } from "@/components/purchase-orders/po-design-select";
import { PoFinishSelect } from "@/components/purchase-orders/po-finish-select";
import { PoRawMaterialSelect } from "@/components/purchase-orders/po-raw-material-select";
import { PoLinesTable } from "@/components/purchase-orders/po-lines-table";
import { useConfirmChange } from "@/components/purchase-orders/po-confirm-change";
import { CABINET_ROW_GRID, Field, fieldInput, selectOnClick, PoCabinetVendorSelect } from "@/components/purchase-orders/po-cabinet-card";
import { PoLibraryContext } from "@/components/purchase-orders/po-library-context";
import { formatInr } from "@/lib/format";
import { recalcCarcass } from "@/lib/purchase-order-from-quote";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { mostUsed, type PoCabinet, type PoGroup, type PurchaseOrderLine } from "@/lib/purchase-order";

// One cabinet inside a component section (By component view): its name, W / D / H / Qty, and only
// this group's rows. Auto Populate shows in Carcass only and only resizes that cabinet's carcass rows.
export function PoCabinetBlock({
  group,
  title,
  srNo,
  lines,
  cabinet,
  onCabinetChange,
  onChange,
  onCopyCabinet,
}: {
  group: PoGroup;
  title: string;
  srNo: number;
  lines: PurchaseOrderLine[];
  cabinet?: PoCabinet;
  onCabinetChange: (cabinet: PoCabinet) => void;
  onChange: (lines: PurchaseOrderLine[]) => void;
  onCopyCabinet: () => void;
}) {
  const cabinetType = useCabinetTypes().find((t) => t.id === cabinet?.cabinetTypeId);
  const { ask, dialog: changeDialog } = useConfirmChange();
  const isManual = !!cabinet && !cabinet.unitName && !cabinet.cabinetTypeId;
  const proforma = useContext(PoLibraryContext) === "proforma";
  // A cabinet with no stored details still shows editable cells; the first edit saves them.
  const cab: PoCabinet = cabinet ?? { label: "", unitName: "", space: "", width: 0, depth: 0, height: 0, qty: 1, cabinetTypeId: "", unitQty: 1, designType: lines.find((l) => l.srNo === srNo)?.designType ?? "" };

  const autoPopulate = () => {
    if (!cabinet || !cabinetType) return;
    const mine = lines.filter((l) => l.srNo === srNo && l.group === "carcass");
    const { lines: next, recalculated } = recalcCarcass({ cabinetType, cabinet, lines: mine, materials: materialSpecStore.getSnapshot() });
    const byId = new Map(next.map((l) => [l.id, l]));
    onChange(lines.map((l) => byId.get(l.id) ?? l));
    toastStore.show(`Cabinet ${srNo}: ${recalculated} carcass row${recalculated === 1 ? "" : "s"} recalculated`, "success");
  };

  // Carcass only: this cabinet's internal / external brand & colour and material, applied to all its carcass rows.
  const mine = lines.filter((l) => l.srNo === srNo && l.group === "carcass");
  const common = (k: "internalColour" | "externalColour" | "material") => mostUsed(mine.map((l) => l[k]));
  const applyAll = (fields: Partial<PurchaseOrderLine>) => onChange(lines.map((l) => (l.srNo === srNo && l.group === "carcass" ? { ...l, ...fields } : l)));
  const iconBtn = "rounded-md p-1 text-grey-400 hover:bg-primary-transparent hover:text-primary";
  // Less-used cabinet fields, shown when the cabinet is opened.
  const extras = (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-grey-100 px-1 pb-1 pt-1.5 md:grid-cols-3">
      <Field label="Design" stacked>
        <input aria-label={`Cabinet ${srNo} design`} {...selectOnClick} className={fieldInput} value={cab.design ?? ""} onChange={(e) => onCabinetChange({ ...cab, design: e.target.value })} />
      </Field>
      {!proforma && cabinet && (
        <Field label="Vendor" stacked>
          <PoCabinetVendorSelect srNo={srNo} cabinet={cabinet} onCabinetChange={(c) => ask("vendor", !!cabinet.vendorId && c.vendorId !== cabinet.vendorId, () => onCabinetChange(c))} />
        </Field>
      )}
    </div>
  );

  return (
    <div className="unit-row border-b border-grey-100 bg-card px-2 py-0.5">
      {changeDialog}
      <PoLinesTable
        group={group}
        title={title}
        lines={lines}
        srNo={srNo}
        vars={cabinet ? { W: cabinet.width, D: cabinet.depth, H: cabinet.height } : undefined}
        // The cabinet drawn as one table line (same columns as By Unit); the group's rows open underneath.
        renderBand={({ collapsed, toggle, total, add, canAdd }) => (
          <>
            <div className={CABINET_ROW_GRID}>
              <div className="cell justify-center">
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={`${collapsed ? "Expand" : "Collapse"} ${title} of cabinet ${srNo}`}
                  aria-expanded={!collapsed}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-grey-500 hover:bg-primary-transparent hover:text-grey-800"
                >
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              <div className="cell num justify-center font-semibold text-primary">{srNo}</div>
              <div className="cell">
                <PoCabinetNameSelect field value={cab.designType ?? ""} fallback={cab.label} onChange={(v, cabinetTypeId) => ask("cabinet type", !!cab.designType && v !== cab.designType, () => onCabinetChange({ ...cab, designType: v, cabinetTypeId }))} />
              </div>
              <div className="cell">
                <PoCabinetNameField stacked value={cab.cabinetName ?? ""} onChange={(v) => ask("cabinet name", !!cab.cabinetName && v !== cab.cabinetName, () => onCabinetChange({ ...cab, cabinetName: v }))} />
              </div>
              {(["width", "depth", "height", "qty"] as const).map((k) => (
                <div key={k} className="cell">
                  <input
                    type="number"
                    min={k === "qty" ? 1 : 0}
                    aria-label={`Cabinet ${srNo} ${k}`}
                    {...selectOnClick}
                    className="num text-center"
                    value={cab[k]}
                    onChange={(e) => onCabinetChange({ ...cab, [k]: e.target.value === "" ? 0 : Number(e.target.value) })}
                  />
                </div>
              ))}
              {group === "carcass" ? (
                <>
                  <div className="cell">
                    <PoFinishSelect kind="internal" value={common("internalColour")} onChange={(v) => ask("internal colour", !!common("internalColour") && common("internalColour") !== v, () => applyAll({ internalColour: v }))} />
                  </div>
                  <div className="cell">
                    <PoFinishSelect kind="external" value={common("externalColour")} onChange={(v) => ask("external colour", !!common("externalColour") && common("externalColour") !== v, () => applyAll({ externalColour: v }))} />
                  </div>
                  <div className="cell">
                    <PoRawMaterialSelect compact value={common("material")} onChange={(v) => ask("material", !!common("material") && common("material") !== v, () => applyAll({ material: v }))} />
                  </div>
                </>
              ) : (
                <>
                  <div className="cell justify-center text-grey-400">—</div>
                  <div className="cell justify-center text-grey-400">—</div>
                  <div className="cell justify-center text-grey-400">—</div>
                </>
              )}
              <div className="cell num justify-end font-semibold text-grey-900">{formatInr(total)}</div>
              <div className="cell justify-end">
                {canAdd && (
                  <button type="button" className={iconBtn} aria-label="Add Row" title="Add Row" onClick={add}>
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                {group === "carcass" && cabinet && <PoComponentsToggle unitName={cabinet.unitName} cabinet={cabinet} onCabinetChange={onCabinetChange} />}
                {group === "carcass" && cabinet && (
                  <button type="button" className={iconBtn} aria-label="Copy cabinet" title="Copy this whole cabinet with all its rows" onClick={onCopyCabinet}>
                    <Copy className="h-4 w-4" />
                  </button>
                )}
                {group === "carcass" && cabinet && !isManual && (
                  <button type="button" className="rounded-md bg-primary p-1 text-white hover:bg-primary/90 disabled:opacity-50" aria-label="Auto Populate" disabled={!cabinetType} onClick={autoPopulate} title="Auto Populate: recalculate this cabinet's carcass sizes from its W / D / H">
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="cell">
                <input aria-label={`Cabinet ${srNo} remark`} {...selectOnClick} placeholder="Remark" value={cab.remark ?? ""} onChange={(e) => onCabinetChange({ ...cab, remark: e.target.value })} />
              </div>
            </div>
            {!collapsed && extras}
          </>
        )}
        defaultCollapsed
        onChange={onChange}
      />
    </div>
  );
}
