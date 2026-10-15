"use client";

import { Copy, Sparkles } from "lucide-react";
import { PoComponentsToggle } from "@/components/purchase-orders/po-components-toggle";
import { Button } from "@/components/ui/button";
import { PoCabinetNameField, PoCabinetNameSelect } from "@/components/purchase-orders/po-design-select";
import { PoFinishSelect } from "@/components/purchase-orders/po-finish-select";
import { PoRawMaterialSelect } from "@/components/purchase-orders/po-raw-material-select";
import { PoLinesTable } from "@/components/purchase-orders/po-lines-table";
import { Field, fieldInput, PoCabinetVendorSelect } from "@/components/purchase-orders/po-cabinet-card";
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
  const isManual = !!cabinet && !cabinet.unitName && !cabinet.cabinetTypeId;
  const name = cabinet?.designType || cabinet?.label || `Cabinet ${srNo}`;

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
  const finishRow = (
    <div className="grid grid-cols-1 gap-3 pl-8 md:grid-cols-4">
      {(
        [
          ...(cabinet
            ? ([["Vendor", <PoCabinetVendorSelect key="v" srNo={srNo} cabinet={cabinet} onCabinetChange={onCabinetChange} className="h-9 w-full rounded-lg border border-grey-100 bg-card px-2 text-[13px] font-body text-grey-900 outline-none focus:border-primary" />]] as const)
            : []),
          ["Internal Brand & Colour", <PoFinishSelect key="i" kind="internal" value={common("internalColour")} onChange={(v) => applyAll({ internalColour: v })} />],
          ["External Brand & Colour", <PoFinishSelect key="e" kind="external" value={common("externalColour")} onChange={(v) => applyAll({ externalColour: v })} />],
          ["Material", <PoRawMaterialSelect key="m" compact value={common("material")} onChange={(v) => applyAll({ material: v })} />],
        ] as const
      ).map(([label, field]) => (
        <Field key={label} label={label}>
          {field}
        </Field>
      ))}
    </div>
  );

  // Title row: the cabinet number and type. Everything else sits in the rows under it (see `fieldsRow`).
  const header = (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/20 px-1.5 font-number text-sm font-semibold text-primary">{srNo}</span>
      {cabinet ? (
        <PoCabinetNameSelect value={cabinet.designType ?? ""} fallback={cabinet.label} onChange={(v, cabinetTypeId) => onCabinetChange({ ...cabinet, designType: v, cabinetTypeId })} />
      ) : (
        <span className="truncate font-heading text-base font-semibold text-grey-900">{name}</span>
      )}
    </span>
  );

  // Second row: Cabinet Name, W / D / H / Qty, Design, Remark, then the checkbox, Copy and Auto Populate. Labels sit above the boxes.
  const fieldsRow = cabinet ? (
    <div className="flex flex-wrap items-end gap-3 pl-8">
      <div className="w-56">
        <Field label="Cabinet Name">
          <PoCabinetNameField stacked value={cabinet.cabinetName ?? ""} onChange={(v) => onCabinetChange({ ...cabinet, cabinetName: v })} />
        </Field>
      </div>
      {(["width", "depth", "height", "qty"] as const).map((k) => (
        <div key={k} className="w-20">
          <Field label={k === "qty" ? "Qty" : k[0].toUpperCase()}>
            <input
              type="number"
              min={k === "qty" ? 1 : 0}
              aria-label={`Cabinet ${srNo} ${k}`}
              className={`${fieldInput} text-right font-number`}
              value={cabinet[k]}
              onChange={(e) => onCabinetChange({ ...cabinet, [k]: e.target.value === "" ? 0 : Number(e.target.value) })}
            />
          </Field>
        </div>
      ))}
      <div className="w-44">
        <Field label="Design">
          <input aria-label={`Cabinet ${srNo} design`} placeholder="Design" className={fieldInput} value={cabinet.design ?? ""} onChange={(e) => onCabinetChange({ ...cabinet, design: e.target.value })} />
        </Field>
      </div>
      <div className="min-w-48 flex-1">
        <Field label="Remark">
          <input aria-label={`Cabinet ${srNo} remark`} placeholder="Remark" className={fieldInput} value={cabinet.remark ?? ""} onChange={(e) => onCabinetChange({ ...cabinet, remark: e.target.value })} />
        </Field>
      </div>
      {group === "carcass" && (
        <div className="flex h-9 shrink-0 items-center gap-2">
          <PoComponentsToggle unitName={cabinet.unitName} />
          <Button type="button" size="icon-sm" variant="outline" className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/25" aria-label="Copy cabinet" title="Copy this whole cabinet with all its rows" onClick={onCopyCabinet}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {!isManual && (
            <Button type="button" size="icon-sm" aria-label="Auto Populate" disabled={!cabinetType} onClick={autoPopulate} title="Auto Populate: recalculate this cabinet's carcass sizes from its W / D / H">
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="rounded-2xl bg-blush p-3">
    <div className="rounded-xl bg-blush p-3">
      <PoLinesTable
        group={group}
        title={title}
        lines={lines}
        srNo={srNo}
        vars={cabinet ? { W: cabinet.width, D: cabinet.depth, H: cabinet.height } : undefined}
        header={header}
        subHeader={
          fieldsRow || group === "carcass" ? (
            <div className="flex flex-col gap-3">
              {fieldsRow}
              {group === "carcass" ? finishRow : null}
            </div>
          ) : undefined
        }
        defaultCollapsed
        onChange={onChange}
      />
    </div>
    </div>
  );
}
