"use client";

import { SelectField } from "@/components/shared/select-field";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useContext, useState } from "react";
import { PoLibraryContext } from "@/components/purchase-orders/po-library-context";
import { ChevronDown, ChevronRight, Copy, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useConfirmChange } from "@/components/purchase-orders/po-confirm-change";
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
// A form field with its label beside it (one line per field, so a cabinet's fields take few lines).
export { selectOnClick } from "@/components/shared/select-on-click";
import { selectOnClick } from "@/components/shared/select-on-click";
export const fieldInput = "h-9 w-full rounded-lg border border-grey-100 bg-card px-2 text-[13px] font-body text-grey-900 outline-none focus:border-primary";
export function Field({ label, children, stacked }: { label: string; children: React.ReactNode; stacked?: boolean }) {
  return (
    <label className={stacked ? "flex min-w-0 flex-col gap-0.5 text-xs" : "flex min-w-0 items-center gap-1.5 text-xs"}>
      <span className={stacked ? "font-body font-medium text-grey-600" : "shrink-0 whitespace-nowrap font-semibold text-grey-900"}>{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
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

// One grid for a cabinet's line and the header row above the list, drawn as a table with a line between cells:
// expand, no., cabinet type, cabinet name, design, vendor (not on a proforma), W, D, H, Qty, internal / external brand & colour,
// material, total, buttons, remark.
// (Whole class names, so Tailwind sees them.)
const GRID_WITH_VENDOR =
  "cab-table grid grid-cols-[32px_32px_minmax(160px,1.4fr)_minmax(130px,1.1fr)_minmax(70px,0.8fr)_minmax(90px,1fr)_46px_46px_46px_40px_minmax(125px,1.2fr)_minmax(125px,1.2fr)_minmax(90px,1fr)_86px_44px_minmax(110px,0.8fr)_124px] items-stretch";
const GRID_NO_VENDOR =
  "cab-table grid grid-cols-[32px_32px_minmax(160px,1.4fr)_minmax(130px,1.1fr)_minmax(70px,0.8fr)_46px_46px_46px_40px_minmax(125px,1.2fr)_minmax(125px,1.2fr)_minmax(90px,1fr)_86px_44px_minmax(110px,0.8fr)_124px] items-stretch";
export const cabinetRowGrid = (proforma: boolean) => (proforma ? GRID_NO_VENDOR : GRID_WITH_VENDOR);
export function PoCabinetListHeader({ proforma = false }: { proforma?: boolean }) {
  const heads = ["", "No", "Cabinet Type", "Cabinet Name", "Design", ...(proforma ? [] : ["Vendor"]), "W", "D", "H", "Qty", "Internal", "External", "Material", "Total", "", "Remark", "Action"];
  const numeric = ["Total"];
  return (
    // The pink band runs the full width of the list; the grid inside lines up with the cabinet lines below it.
    <div className="rounded-t-md border border-grey-200 bg-[#DACCCC] pl-[40px] pr-2">
      <div className={`${cabinetRowGrid(proforma)} cab-head text-sm font-body font-medium text-grey-900`}>
        {heads.map((h, i) => (
          <div key={i} className={`cell ${["W", "D", "H", "Qty", "No", "Action"].includes(h) ? "justify-center" : numeric.includes(h) ? "justify-end" : ""}`}>{h}</div>
        ))}
      </div>
    </div>
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
  const { ask, dialog: changeDialog } = useConfirmChange();
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

  // This cabinet's internal / external brand & colour and material, applied to all its carcass rows (same as By component).
  const carcassRows = mine.filter((l) => l.group === "carcass");
  const commonCarcass = (k: "internalColour" | "externalColour" | "material") =>
    mostUsed(carcassRows.map((l) => l[k])) || (cabinet?.[k] ?? "") || (detailDefaults?.[k] ?? "");
  // Also remembered on the cabinet, so a cabinet without rows yet gives them to the rows Auto Populate adds.
  // Direct PO: changing a value this cabinet already has asks first (it changes its Carcass rows too). The Cabinet Details card is not touched.
  const askCarcass = (k: "internalColour" | "externalColour" | "material", v: string) =>
    ask(k === "internalColour" ? "internal colour" : k === "externalColour" ? "external colour" : "material", !!commonCarcass(k) && commonCarcass(k) !== v, () => applyCarcass({ [k]: v }));
  const applyCarcass = (fields: Partial<PurchaseOrderLine>) => {
    if (cabinet && carcassRows.length === 0) onCabinetChange({ ...cabinet, ...fields } as PoCabinet);
    else onChange(lines.map((l) => (l.srNo === srNo && l.group === "carcass" ? { ...l, ...fields } : l)));
  };

  // A cabinet with no stored details (older PO, or rows added without them) still shows editable fields; the first edit saves them.
  const cab: PoCabinet = cabinet ?? { label: "", unitName: "", space: "", width: 0, depth: 0, height: 0, qty: 1, cabinetTypeId: "", unitQty: 1, designType };
  const showFinishes = direct || mine.some((l) => l.group === "carcass");
  const stackedField = (label: string, node: React.ReactNode) => <Field key={label} label={label} stacked>{node}</Field>;
  // The less-used fields of a cabinet, labels above the boxes, shown when it is opened.
  const extras = cabinet && !direct && (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-grey-100 px-1 pb-1 pt-1.5 md:grid-cols-3">
      {stackedField(
        "Unit Type",
        <SelectField aria-label={`Cabinet ${srNo} unit type`} className={fieldInput} value={cabinet.unitName ?? ""} onChange={(e) => onCabinetChange({ ...cabinet, unitName: e.target.value })}>
          <option value="">Select unit type</option>
          {cabinet.unitName && !unitTypes.some((u) => u.name === cabinet.unitName) && <option value={cabinet.unitName}>{cabinet.unitName}</option>}
          {unitTypes.map((u) => (
            <option key={u.id} value={u.name}>{u.name}</option>
          ))}
        </SelectField>
      )}
    </div>
  );

  return (
    <div className="unit-row border-b border-grey-100 bg-card px-2 py-0.5">
    <div className="flex flex-col gap-1">
      {/* One table line per cabinet, the columns named by the header row above the list (PoCabinetListHeader). */}
      <div className={cabinetRowGrid(proforma)}>
        <div className="cell justify-center">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={`${collapsed ? "Expand" : "Collapse"} cabinet ${srNo}`}
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
        <div className="cell">
          <input aria-label={`Cabinet ${srNo} design`} {...selectOnClick} placeholder="Design" value={cab.design ?? ""} onChange={(e) => onCabinetChange({ ...cab, design: e.target.value })} />
        </div>
        {/* A Proforma Invoice has a dealer for the whole invoice, so no vendor is picked per cabinet. */}
        {!proforma && (
          <div className="cell">
            <PoCabinetVendorSelect srNo={srNo} cabinet={cab} onCabinetChange={(c) => ask("vendor", !!cab.vendorId && c.vendorId !== cab.vendorId, () => onCabinetChange(c))} />
          </div>
        )}
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
        {/* The cabinet's carcass finishes and material, applied to all its carcass rows. */}
        {showFinishes ? (
          <>
            <div className="cell">
              <PoFinishSelect kind="internal" value={commonCarcass("internalColour")} onChange={(v) => askCarcass("internalColour", v)} />
            </div>
            <div className="cell">
              <PoFinishSelect kind="external" value={commonCarcass("externalColour")} onChange={(v) => askCarcass("externalColour", v)} />
            </div>
            <div className="cell">
              <PoRawMaterialSelect value={commonCarcass("material")} onChange={(v) => askCarcass("material", v)} />
            </div>
          </>
        ) : (
          <>
            <div className="cell justify-center text-grey-400">—</div>
            <div className="cell justify-center text-grey-400">—</div>
            <div className="cell justify-center text-grey-400">—</div>
          </>
        )}
        <div className="cell num justify-end font-semibold text-grey-900">
          {/* A Proforma Invoice shows the cabinet's total sq.ft before its amount. */}
          {proforma && <span className="mr-2 font-normal text-grey-500">{totalSqft.toFixed(2)}</span>}
          {formatInr(total)}
        </div>
        <div className="cell justify-end">
          {cabinet && !isManual && <PoComponentsToggle unitName={cabinet.unitName} cabinet={cabinet} onCabinetChange={onCabinetChange} proforma={proforma} />}
        </div>
        <div className="cell">
          <input aria-label={`Cabinet ${srNo} remark`} {...selectOnClick} placeholder="Remark" value={cab.remark ?? ""} onChange={(e) => onCabinetChange({ ...cab, remark: e.target.value })} />
        </div>
        <div className="cell justify-center gap-0.5">
          {onCopyCabinet && (
            <button type="button" className="rounded-md p-1 text-grey-400 hover:bg-primary-transparent hover:text-primary" aria-label="Copy cabinet" title="Copy this whole cabinet with all its rows" onClick={onCopyCabinet}>
              <Copy className="h-4 w-4" />
            </button>
          )}
          <button type="button" className="rounded-md p-1 text-grey-400 hover:bg-primary-transparent hover:text-primary" aria-label={`${collapsed ? "Open" : "Close"} cabinet ${srNo} to edit`} title={collapsed ? "Open to edit" : "Close"} onClick={() => setCollapsed((x) => !x)}>
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-md p-1 text-grey-400 hover:bg-error-transparent hover:text-error" aria-label="Delete cabinet" title="Delete this cabinet and all its rows" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </button>
          {!isManual && (
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

      {!collapsed && extras}

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
    {changeDialog}
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
