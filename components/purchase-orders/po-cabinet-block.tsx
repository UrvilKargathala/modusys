"use client";

import { Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PoCabinetNameField, PoCabinetNameSelect } from "@/components/purchase-orders/po-design-select";
import { PoLinesTable } from "@/components/purchase-orders/po-lines-table";
import { recalcCarcass } from "@/lib/purchase-order-from-quote";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import type { PoCabinet, PoGroup, PurchaseOrderLine } from "@/lib/purchase-order";

const dimInput =
  "h-8 w-16 rounded-md border border-grey-100 bg-card px-2 text-right text-sm font-number text-grey-900 outline-none focus:border-primary";

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

  const header = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="flex min-w-0 max-w-[260px] shrink items-center gap-2">
        <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary-transparent px-1.5 font-number text-sm font-semibold text-primary">{srNo}</span>
        {cabinet ? (
          <PoCabinetNameSelect value={cabinet.designType ?? ""} fallback={cabinet.label} onChange={(v) => onCabinetChange({ ...cabinet, designType: v })} />
        ) : (
          <span className="truncate font-heading text-base font-semibold text-grey-900">{name}</span>
        )}
      </span>
      {cabinet && (
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <PoCabinetNameField value={cabinet.cabinetName ?? ""} onChange={(v) => onCabinetChange({ ...cabinet, cabinetName: v })} />
          {(["width", "depth", "height", "qty"] as const).map((k) => (
            <label key={k} className="flex shrink-0 items-center gap-1 text-xs text-grey-500">
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
          <input
            aria-label={`Cabinet ${srNo} design`}
            placeholder="Design"
            className="h-8 w-32 shrink-0 rounded-md border border-grey-100 bg-card px-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
            value={cabinet.design ?? ""}
            onChange={(e) => onCabinetChange({ ...cabinet, design: e.target.value })}
          />
          <input
            aria-label={`Cabinet ${srNo} remark`}
            placeholder="Remark"
            className="h-8 min-w-40 max-w-md flex-1 rounded-md border border-grey-100 bg-card px-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
            value={cabinet.remark ?? ""}
            onChange={(e) => onCabinetChange({ ...cabinet, remark: e.target.value })}
          />
          {group === "carcass" && (
            <Button type="button" size="icon-sm" variant="outline" aria-label="Copy cabinet" title="Copy this whole cabinet with all its rows" onClick={onCopyCabinet}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          {group === "carcass" && !isManual && (
            <Button type="button" size="icon-sm" aria-label="Auto Populate" disabled={!cabinetType} onClick={autoPopulate} title="Auto Populate: recalculate this cabinet's carcass sizes from its W / D / H">
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          )}
        </span>
    )}
    </div>
  );

  return (
    <div className="rounded-lg border border-grey-100 bg-card p-3">
      <PoLinesTable
        group={group}
        title={title}
        lines={lines}
        srNo={srNo}
        vars={cabinet ? { W: cabinet.width, D: cabinet.depth, H: cabinet.height } : undefined}
        header={header}
        defaultCollapsed
        onChange={onChange}
      />
    </div>
  );
}
