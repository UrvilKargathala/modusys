"use client";

import { SelectField } from "@/components/shared/select-field";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useContext, useState } from "react";
import { PoLibraryContext } from "@/components/purchase-orders/po-library-context";
import { ChevronDown, ChevronRight, Copy, Plus, Sparkles, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { PoCabinetNameField, PoCabinetNameSelect } from "@/components/purchase-orders/po-design-select";
import { PoComponentsToggle } from "@/components/purchase-orders/po-components-toggle";
import { PoFinishSelect } from "@/components/purchase-orders/po-finish-select";
import { PoRawMaterialSelect } from "@/components/purchase-orders/po-raw-material-select";
import { PoDefaultVendorContext, PoLinesTable, newBlankLine } from "@/components/purchase-orders/po-lines-table";
import { formatInr } from "@/lib/format";
import { buildCarcassFromType, recalcCarcass } from "@/lib/purchase-order-from-quote";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { useVendors } from "@/lib/store/vendors-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { PO_GROUPS, lineAmount, mostUsed, type PoCabinet, type PurchaseOrderLine } from "@/lib/purchase-order";

// One cabinet of the quote: header (number, unit/cabinet name, W/D/H/Qty) and its components
// underneath, grouped Carcass / Shutter / Other Panel / Hardware — the same flow as the quote.
// W/D/H/Qty start as the quote's cabinet size and are editable; the rows are snapshots, so they only
// change when you press Auto Populate (same as the quote: carcass rows only, from the cabinet type's formulas).
// A form field with its label above it.
// A click into the box selects everything in it; a double click then selects just the word under the pointer, as usual.
export const selectOnClick = {
  onMouseDown: (e: React.MouseEvent<HTMLInputElement>) => {
    if (document.activeElement !== e.currentTarget) e.currentTarget.dataset.fresh = "1";
  },
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select(),
  onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => {
    if (e.currentTarget.dataset.fresh) {
      e.preventDefault();
      delete e.currentTarget.dataset.fresh;
    }
  },
};
export const fieldInput = "h-9 w-full rounded-lg border border-grey-100 bg-card px-2 text-[13px] font-body text-grey-900 outline-none focus:border-primary";
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs">
      <span className="font-semibold text-grey-900">{label}</span>
      {children}
    </label>
  );
}

// A cabinet's own vendor (blank = the PO's vendor). Used in By cabinet and By component.
export function PoCabinetVendorSelect({ srNo, cabinet, onCabinetChange, className = fieldInput }: { srNo: number; cabinet: PoCabinet; onCabinetChange: (cabinet: PoCabinet) => void; className?: string }) {
  const vendors = useVendors();
  const poVendorId = useContext(PoDefaultVendorContext);
  return (
    <SelectField aria-label={`Cabinet ${srNo} vendor`} className={className} value={cabinet.vendorId ?? ""} onChange={(e) => onCabinetChange({ ...cabinet, vendorId: e.target.value || undefined })}>
      {/* Blank = follows the PO's vendor: shown by name. */}
      <option value="">{vendors.find((v) => v.id === poVendorId)?.name ?? "Select vendor"}</option>
      {vendors.filter((v) => v.id !== poVendorId).map((v) => (
        <option key={v.id} value={v.id}>{v.name}</option>
      ))}
    </SelectField>
  );
}

export function PoCabinetCard({
  srNo,
  lines,
  cabinet,
  onCabinetChange,
  onChange,
  onRemove,
  onCopyCabinet,
  direct,
  detailDefaults,
}: {
  srNo: number;
  lines: PurchaseOrderLine[];
  cabinet?: PoCabinet;
  onCabinetChange: (cabinet: PoCabinet) => void;
  onChange: (lines: PurchaseOrderLine[]) => void;
  onRemove: () => void;
  onCopyCabinet?: () => void;
  // Direct Purchase Order: no Unit Type and no Add rows buttons (its Shutter and Other Panel have their own tabs).
  direct?: boolean;
  // Direct PO: the Cabinet Details card's values, used while this cabinet has none of its own.
  detailDefaults?: { internalColour: string; externalColour: string; material: string };
}) {
  const mine = lines.filter((l) => l.srNo === srNo);
  // Collapsed by default: a PO can have dozens of cabinets, so open only the ones you need.
  // A cabinet with no rows yet (just added by hand) starts open so you can fill it.
  const [collapsed, setCollapsed] = useState(mine.length > 0);
  const designType = mine[0]?.designType ?? "";
  const total = mine.reduce((s, l) => s + lineAmount(l), 0);
  const totalSqft = mine.filter((l) => l.group !== "hardware").reduce((s, l) => s + l.sqft, 0);

  const unitTypes = useUnitTypes();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingFields, setPendingFields] = useState<Partial<PurchaseOrderLine> | null>(null);
  const cabinetType = useCabinetTypes().find((t) => t.id === cabinet?.cabinetTypeId);

  // Recalculate the sizes of this cabinet's existing carcass rows for the W/D/H/Qty in the header.
  // Rows are never added or removed, and rate / remarks / finishes stay as typed.
  const autoPopulate = () => {
    if (!cabinet || !cabinetType) return;
    const mineCarcass = lines.filter((l) => l.srNo === srNo && l.group === "carcass");
    // A cabinet with no carcass rows yet, or only a blank one (added by hand): fill it with all the components of its cabinet type.
    // Blank starter rows (nothing typed) don't count: they are replaced.
    if (mineCarcass.every((l) => !l.description && !l.width && !l.height)) {
      const rows = buildCarcassFromType({ cabinetType, cabinet: { ...cabinet, internalColour: cabinet.internalColour || detailDefaults?.internalColour, externalColour: cabinet.externalColour || detailDefaults?.externalColour, material: cabinet.material || detailDefaults?.material }, srNo, materials: materialSpecStore.getSnapshot() });
      if (rows.length === 0) {
        toastStore.show("This cabinet type has no components to add.", "error");
        return;
      }
      onChange([...lines.filter((l) => !mineCarcass.includes(l)), ...rows.map((r, i) => ({ ...r, id: `new-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}` }))].map((l, i) => ({ ...l, position: i })));
      toastStore.show(`Cabinet ${srNo}: ${rows.length} carcass row${rows.length === 1 ? "" : "s"} added from ${cabinetType.name}`, "success");
      return;
    }
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
  const proforma = useContext(PoLibraryContext) === "proforma";
  const isManual = !!cabinet && !cabinet.unitName && !cabinet.cabinetTypeId;
  const emptyGroups = PO_GROUPS.filter((g) => !mine.some((l) => l.group === g.key));

  const name = cabinet?.label;
  // This cabinet's internal / external brand & colour and material, applied to all its carcass rows (same as By component).
  const carcassRows = mine.filter((l) => l.group === "carcass");
  const commonCarcass = (k: "internalColour" | "externalColour" | "material") =>
    mostUsed(carcassRows.map((l) => l[k])) || (cabinet?.[k] ?? "") || (detailDefaults?.[k] ?? "");
  // Also remembered on the cabinet, so a cabinet without rows yet gives them to the rows Auto Populate adds.
  // Direct PO: changing a value this cabinet already has asks first (it changes its Carcass rows too). The Cabinet Details card is not touched.
  const askCarcass = (k: "internalColour" | "externalColour" | "material", v: string) => (direct && commonCarcass(k) ? setPendingFields({ [k]: v }) : applyCarcass({ [k]: v }));
  const applyCarcass = (fields: Partial<PurchaseOrderLine>) => {
    if (cabinet && carcassRows.length === 0) onCabinetChange({ ...cabinet, ...fields } as PoCabinet);
    else onChange(lines.map((l) => (l.srNo === srNo && l.group === "carcass" ? { ...l, ...fields } : l)));
  };

  return (
    <div className="rounded-2xl bg-blush p-3">
    <div className="flex flex-col gap-3 rounded-xl bg-blush p-3">
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
              <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/20 px-1.5 font-number text-sm font-semibold text-primary">{srNo}</span>
            </button>
            {/* Locked: the name comes from the Cabinet Type, so there is nothing to type here. */}
            <div
              aria-label={`Cabinet ${srNo} name (set by the Cabinet Type)`}
              title="Pick a Cabinet Type below; the name is set from it"
              className="flex h-8 w-72 min-w-0 cursor-not-allowed items-center gap-2 rounded-md border border-grey-100 bg-grey-transparent px-2 text-sm font-body text-grey-400"
            >
              <span className="min-w-0 flex-1 truncate">{cabinet.label || "Select a Cabinet Type"}</span>
            </div>
          </div>
        ) : (
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={`${collapsed ? "Expand" : "Collapse"} cabinet ${srNo}`}
            aria-expanded={!collapsed}
            className="flex items-center gap-2 hover:text-primary"
          >
            {collapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-grey-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-grey-500" />}
            <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/20 px-1.5 font-number text-sm font-semibold text-primary">{srNo}</span>
          </button>
          {/* A cabinet with a Cabinet Type has its name filled from the type: shown in a grey locked box. */}
          <div
            aria-label={`Cabinet ${srNo} name (set by the Cabinet Type)`}
            title="Set by the Cabinet Type"
            className="flex h-8 w-72 min-w-0 cursor-not-allowed items-center gap-2 rounded-md border border-grey-100 bg-grey-transparent px-2 text-sm font-body font-semibold text-grey-700"
          >
            <span className="min-w-0 flex-1 truncate">
              {cabinet?.unitName || name || cabinet?.designType || `Cabinet ${srNo}`}
              {designType && <span className="ml-2 font-number text-xs font-normal text-error">{designType}</span>}
            </span>
          </div>
          {cabinet?.space && <span className="hidden text-xs font-body text-grey-500 md:inline">{cabinet.space}</span>}
        </div>
        )}
        <div className="flex items-center gap-3">
          {/* A Proforma Invoice shows the cabinet's total sq.ft before its amount. */}
          {proforma && <span className="font-number text-sm text-grey-500">{totalSqft.toFixed(2)} sq.ft</span>}
          <span className="font-number text-base font-semibold text-grey-900">{formatInr(total)}</span>
          {cabinet && !isManual && <PoComponentsToggle unitName={cabinet.unitName} cabinet={cabinet} onCabinetChange={onCabinetChange} />}
          {cabinet && onCopyCabinet && (
            <Button type="button" size="icon-sm" variant="outline" className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/25" aria-label="Copy cabinet" title="Copy this whole cabinet with all its rows" onClick={onCopyCabinet}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          {cabinet && (
            <Button type="button" size="icon-sm" variant="outline" className="border-error/30 bg-error-transparent text-error hover:bg-error-100" aria-label="Delete cabinet" title="Delete this cabinet and all its rows" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
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
                {...selectOnClick}
                className={fieldInput + " text-right font-number"}
                value={cabinet[k]}
                onChange={(e) => onCabinetChange({ ...cabinet, [k]: e.target.value === "" ? 0 : Number(e.target.value) })}
              />
            </Field>
          ))}
          <Field label="Design">
            <input aria-label={`Cabinet ${srNo} design`} {...selectOnClick} className={fieldInput} value={cabinet.design ?? ""} onChange={(e) => onCabinetChange({ ...cabinet, design: e.target.value })} />
          </Field>
          <Field label="Remark">
            <input aria-label={`Cabinet ${srNo} remark`} {...selectOnClick} className={fieldInput} value={cabinet.remark ?? ""} onChange={(e) => onCabinetChange({ ...cabinet, remark: e.target.value })} />
          </Field>
        </div>
      )}

      {cabinet && (
        <div className={`grid grid-cols-1 gap-3 pl-8 ${direct ? (proforma ? "md:grid-cols-3" : "md:grid-cols-4") : "md:grid-cols-5"}`}>
          {!direct && <Field label="Unit Type">
            <SelectField aria-label={`Cabinet ${srNo} unit type`} className={fieldInput} value={cabinet.unitName ?? ""} onChange={(e) => onCabinetChange({ ...cabinet, unitName: e.target.value })}>
              <option value="">Select unit type</option>
              {cabinet.unitName && !unitTypes.some((u) => u.name === cabinet.unitName) && <option value={cabinet.unitName}>{cabinet.unitName}</option>}
              {unitTypes.map((u) => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </SelectField>
          </Field>}
          {/* A Proforma Invoice has a dealer for the whole invoice, so no vendor is picked per cabinet. */}
          {!proforma && (
          <Field label="Vendor">
            <PoCabinetVendorSelect srNo={srNo} cabinet={cabinet} onCabinetChange={onCabinetChange} />
          </Field>
          )}
          {(direct || mine.some((l) => l.group === "carcass")) && (
            <>
          <Field label="Internal Brand & Colour">
            <PoFinishSelect kind="internal" value={commonCarcass("internalColour")} onChange={(v) => askCarcass("internalColour", v)} />
          </Field>
          <Field label="External Brand & Colour">
            <PoFinishSelect kind="external" value={commonCarcass("externalColour")} onChange={(v) => askCarcass("externalColour", v)} />
          </Field>
          <Field label="Material">
            <PoRawMaterialSelect value={commonCarcass("material")} onChange={(v) => askCarcass("material", v)} />
          </Field>
            </>
          )}
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
              // Each section (Carcass, Shutter, ...) starts closed: open the ones you need.
              defaultCollapsed
              onChange={onChange}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {!direct && emptyGroups.length > 0 && <span className="text-xs font-body text-grey-500">Add rows:</span>}
            {!direct && emptyGroups.map((g) => (
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
    <ConfirmDialog
      open={!!pendingFields}
      onOpenChange={(o) => !o && setPendingFields(null)}
      title="Change this cabinet?"
      description={carcassRows.length ? `This also updates the Material and colours of the ${carcassRows.length} Carcass row${carcassRows.length === 1 ? "" : "s"} in this cabinet. Continue?` : "This changes the Material and colours of this cabinet. Continue?"}
      confirmLabel="Continue"
      onConfirm={() => {
        if (pendingFields) applyCarcass(pendingFields);
        setPendingFields(null);
      }}
    />
    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title={`Delete cabinet ${srNo}?`}
      description={mine.length ? `This removes the cabinet and its ${mine.length} row${mine.length === 1 ? "" : "s"}. It can't be undone until you Cancel the PO without saving.` : "This removes the empty cabinet."}
      onConfirm={onRemove}
    />
    </div>
    </div>
  );
}
