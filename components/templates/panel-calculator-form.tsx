"use client";

import { SelectField } from "@/components/shared/select-field";
import { useMemo, useState } from "react";
import { Calculator, Eraser, Plus, Trash2, AlertCircle, Save, FolderOpen } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { usePanelCalcTickets, panelCalcTicketStore, ticketTime, type PanelCalcTicket } from "@/lib/store/panel-calc-ticket-store";
import { panelSqft } from "@/lib/purchase-order";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { usePanelCalcSpecs, panelCalcSpecStore } from "@/lib/store/panel-calc-spec-store";
import { materialSpecStore, useMaterialItems } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { evaluateFormula } from "@/lib/quote-pricing";
import { findPanelSpec } from "@/lib/panel-spec-match";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { PANEL_CALCULATOR_ROWS_KEY } from "@/components/shared/panel-calculator-context";
import type { PanelFormula } from "@/lib/mock/panel-calc-spec";
import type { FurnitureLineItem } from "@/lib/mock/unit-type";
import { FurnitureGroup, blankLineItem } from "@/components/quotes/create/quote-cabinet-group";

type ResultRow = { id: string; label: string; thickness: number; width: number; height: number; qty: number };

// Panel formulas are authored with L for Length (W/L/H); evaluateFormula's
// own allow-list is W/D/H, so L is swapped for D right before evaluating.
const toEvalFormula = (formula: string) => formula.replace(/l/gi, "D");
const formulaPattern = /^[\d\s+\-*/().WLHwlh]+$/;

const newPanel = (): PanelFormula => ({
  id: `panel-${Date.now()}-${Math.random()}`,
  label: "",
  widthFormula: "",
  heightFormula: "",
  thickness: 0,
});

function computeResults(panels: PanelFormula[], width: number, length: number, height: number): ResultRow[] {
  const vars = { W: width, D: length, H: height };
  return panels.map((p) => ({
    id: p.id,
    label: p.label,
    thickness: p.thickness,
    qty: p.qty ?? 1,
    width: Math.round(evaluateFormula(toEvalFormula(p.widthFormula), vars)),
    height: Math.round(evaluateFormula(toEvalFormula(p.heightFormula), vars)),
  }));
}

// onAdd: opened from somewhere else (a Requirement Order unit's Other Panel): Calculate hands the rows to it instead of this
// page's own Other Panel table, which isn't shown then.
export function PanelCalculatorForm({ onAdd }: { onAdd?: (lines: FurnitureLineItem[]) => void } = {}) {
  const specs = usePanelCalcSpecs();
  const componentItems = useMaterialItems("furniture-component");

  // No Brand here: specs are picked by Product (a spec's saved brand, if any, isn't asked for).
  const products = useMemo(() => [...new Set(specs.map((s) => s.product))].sort(), [specs]);
  const [product, setProduct] = useState("");

  const [width, setWidth] = useState<number | "">("");
  // Runner Length is typed like Clear Width and optional: left empty it counts as 0, matching a spec saved without it.
  // There's no Height field any more: H counts as 0.
  const [length, setLength] = useState<number | "">("");
  const L = length === "" ? 0 : length;
  const H = 0;

  // The Other Panel table (the quote's): each Calculate adds the spec's panels as rows, cut size filled in, for materials and
  // pricing to be picked like in a quote. Kept in this browser (switching tabs, leaving or reloading keeps it); only Clear Data
  // empties it.
  const [tableRows, setTableRows] = useLocalStorage<FurnitureLineItem[]>(PANEL_CALCULATOR_ROWS_KEY, []);
  // Qty: multiplies each panel's own qty from the spec (empty or below 1 counts as 1).
  const [qty, setQty] = useState<number | "">(1);
  const Q = qty === "" || qty < 1 ? 1 : qty;
  // Clear Data empties only the Other Panel table; Undo puts the rows back.
  const clearTable = () => {
    const before = tableRows;
    setTableRows([]);
    toastStore.show(`Cleared ${before.length} row${before.length === 1 ? "" : "s"} from the table`, "success", {
      durationMs: 8000,
      action: { label: "Undo", onClick: () => setTableRows(before) },
    });
  };
  // Save: the table as the next ticket (shared, numbered by the server, latest 5 kept). The table stays as it is.
  const tickets = usePanelCalcTickets();
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "open" | "delete"; ticket: PanelCalcTicket } | null>(null);
  const saveTicket = async () => {
    setSaving(true);
    const saved = await panelCalcTicketStore.save(tableRows);
    setSaving(false);
    if (saved) toastStore.show(`Saved as Ticket ${saved.no}`, "success");
    else toastStore.show("Couldn't save the ticket. Try again.", "error");
  };
  const openTicket = (t: PanelCalcTicket) => {
    setTableRows(t.rows);
    toastStore.show(`Opened Ticket ${t.no}`, "success");
  };
  const deleteTicket = async (t: PanelCalcTicket) => {
    if (await panelCalcTicketStore.remove(t.id)) toastStore.show(`Deleted Ticket ${t.no}`, "success");
    else toastStore.show("Couldn't delete the ticket. Try again.", "error");
  };
  const sizeOf = (formula: string) => Math.round(evaluateFormula(formula, { W: 0, D: 0, H: 0 }));
  const sqftOf = (rows: FurnitureLineItem[]) =>
    rows.reduce((sum, r) => sum + panelSqft(sizeOf(r.widthFormula), sizeOf(r.heightFormula), Math.max(1, r.qty || 1)), 0);

  // The spec's thickness (mm) as a Material Library Thickness entry ("16mm"); added to that list when it isn't there yet.
  const thicknessIdFor = (mm: number) => {
    if (!(mm > 0)) return "";
    const hit = materialSpecStore.getSnapshot().find((t) => t.category === "thickness" && !t.deleted && parseFloat(t.name) === mm);
    return hit ? hit.id : materialSpecStore.createItem({ category: "thickness", name: `${String(mm).padStart(2, "0")}mm`, description: "" }).id;
  };
  const addToTable = (rows: ResultRow[]) => {
    const lines: FurnitureLineItem[] = rows.map((r) => ({
      ...blankLineItem(),
      componentTypeId: componentItems.find((c) => c.name === r.label)?.id ?? "",
      widthFormula: String(r.width),
      heightFormula: String(r.height),
      thicknessId: thicknessIdFor(r.thickness),
      qty: r.qty * Q,
    }));
    if (onAdd) onAdd(lines);
    else setTableRows((prev) => [...prev, ...lines]);
    toastStore.show(`Added ${rows.length} panel${rows.length === 1 ? "" : "s"} (Qty ${Q}) to ${onAdd ? "this Other Panel" : "the table"}`, "success");
  };

  // Nothing computes until Calculate is clicked — typing dimensions doesn't
  // auto-search, and the "no spec found" build-your-own panels below only
  // appears after a real search comes back empty.
  const [searched, setSearched] = useState(false);
  const [matchedSpec, setMatchedSpec] = useState<(typeof specs)[number] | null>(null);
  const [draftPanels, setDraftPanels] = useState<PanelFormula[]>([]);

  const canCalculate = !!product && width !== "";

  const runCalculate = () => {
    if (!canCalculate) return;
    const match = findPanelSpec(specs, "", product, L, H);
    setMatchedSpec(match ?? null);
    setSearched(true);
    setDraftPanels(match ? [] : [newPanel(), newPanel()]);

    if (match) {
      const rows = computeResults(match.panels, width, L, H);
      addToTable(rows);
    }
  };

  const updateDraftPanel = (id: string, patch: Partial<PanelFormula>) =>
    setDraftPanels((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const draftValid =
    draftPanels.length > 0 &&
    draftPanels.every(
      (p) =>
        p.label.trim() &&
        formulaPattern.test(p.widthFormula) &&
        p.widthFormula.trim() &&
        formulaPattern.test(p.heightFormula) &&
        p.heightFormula.trim()
    );

  const saveDraftAsSpec = () => {
    if (!draftValid) return;
    const created = panelCalcSpecStore.createSpec({
      brand: "", product, length: L, height: H, description: "", panels: draftPanels,
    });
    toastStore.show(`Saved as a new Panel Spec`, "success");
    setMatchedSpec(created);
    setDraftPanels([]);

    if (width !== "") {
      const rows = computeResults(created.panels, width, L, H);
      addToTable(rows);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_1fr_0.5fr_auto_auto_auto]">
        <div className="flex flex-col gap-1.5">
          <Label>Product</Label>
          <SelectField
            value={product}
            onChange={(e) => { setProduct(e.target.value); setLength(""); setSearched(false); setMatchedSpec(null); }}
            className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary disabled:bg-light-600 disabled:text-grey-300"
          >
            <option value="">Select product</option>
            {products.map((p) => <option key={p} value={p}>{p}</option>)}
          </SelectField>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Clear Width (mm)</Label>
          <Input
            type="number"
            placeholder="e.g. 550"
            disabled={!product}
            value={width}
            onChange={(e) => { setWidth(e.target.value === "" ? "" : Number(e.target.value)); setSearched(false); setMatchedSpec(null); }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Runner Length (mm)</Label>
          <Input
            type="number"
            min={0}
            placeholder="Optional, e.g. 550"
            disabled={!product}
            value={length}
            onChange={(e) => { setLength(e.target.value === "" ? "" : Number(e.target.value)); setSearched(false); setMatchedSpec(null); }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Qty</Label>
          <Input
            type="number"
            min={1}
            placeholder="1"
            disabled={!product}
            value={qty}
            onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>

        <Button type="button" onClick={runCalculate} disabled={!canCalculate} className="self-end">
          <Calculator className="h-4 w-4" />
          Calculate
        </Button>
        {!onAdd && (
          <Button type="button" variant="outline" onClick={clearTable} disabled={tableRows.length === 0} className="self-end">
            <Eraser className="h-4 w-4" />
            Clear Data
          </Button>
        )}
        {!onAdd && (
          <Button type="button" variant="outline" onClick={saveTicket} disabled={tableRows.length === 0 || saving} className="self-end">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
      </div>

      {!onAdd && (
        <FurnitureGroup
          title="Other Panel"
          label="Other Panel"
          showComponentName
          showLevelType
          accent="warning"
          items={tableRows}
          unit={{ width: 0, depth: 0, height: 0, qty: 1 }}
          onChange={setTableRows}
          addLabel="Other Panel"
          defaultOpen
        />
      )}

      {!onAdd && tickets.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-sm font-semibold text-grey-900">Saved Tickets</h3>
          <div className="overflow-x-auto rounded-md border border-grey-100">
            <div className="min-w-[560px]">
              <div className="table-head grid grid-cols-[5rem_1fr_1fr_5rem_6rem_9rem] gap-2 bg-[var(--table-head)] px-3 py-1.5 text-xs font-medium text-grey-900">
                <span>Ticket</span>
                <span>Saved</span>
                <span>By</span>
                <span className="text-center">Panels</span>
                <span className="text-center">Sq.ft</span>
                <span className="text-center">Actions</span>
              </div>
              {tickets.map((t) => (
                <div key={t.id} className="grid grid-cols-[5rem_1fr_1fr_5rem_6rem_9rem] items-center gap-2 border-t border-grey-100 px-3 py-1.5 text-sm">
                  <span className="font-number font-medium text-grey-900">#{t.no}</span>
                  <span className="font-number text-grey-600">{ticketTime(t.createdAt)}</span>
                  <span className="truncate font-body text-grey-600">{t.createdBy || "—"}</span>
                  <span className="text-center font-number">{t.rows.length}</span>
                  <span className="text-center font-number">{sqftOf(t.rows).toFixed(2)}</span>
                  <span className="flex justify-center gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => (tableRows.length ? setConfirm({ kind: "open", ticket: t }) : openTicket(t))}>
                      <FolderOpen className="h-3.5 w-3.5" />
                      Open
                    </Button>
                    <button type="button" onClick={() => setConfirm({ kind: "delete", ticket: t })} aria-label={`Delete Ticket ${t.no}`} className="rounded-md p-2 text-grey-400 hover:bg-error-transparent hover:text-error">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={confirm.kind === "open" ? `Open Ticket ${confirm.ticket.no}?` : `Delete Ticket ${confirm.ticket.no}?`}
          description={
            confirm.kind === "open"
              ? `The ${tableRows.length} row${tableRows.length === 1 ? "" : "s"} in the table will be replaced by this ticket's ${confirm.ticket.rows.length}. Save them first if you need them.`
              : "It is removed for everyone. This can't be undone."
          }
          confirmLabel={confirm.kind === "open" ? "Open" : "Delete"}
          onConfirm={() => {
            if (confirm.kind === "open") openTicket(confirm.ticket);
            else void deleteTicket(confirm.ticket);
            setConfirm(null);
          }}
        />
      )}

      {!searched && (onAdd || tableRows.length === 0) ? (
        <div className="rounded-lg border border-grey-100 bg-light-600 p-5">
          <div className="flex items-center gap-2 text-sm font-body text-grey-400">
            <Calculator className="h-4 w-4" />
            Select a Product, enter Clear Width (and Runner Length if the formulas use it), then click Calculate. The panels are added to {onAdd ? "this Other Panel" : "the table above"}.
          </div>
        </div>
      ) : searched && !matchedSpec ? (
        <div className="flex flex-col gap-4 rounded-lg border border-dashed border-grey-200 p-5">
          <div className="flex items-center gap-2 text-sm font-body text-grey-500">
            <AlertCircle className="h-4 w-4 shrink-0 text-grey-300" />
            No panel spec found for {product}{L ? ` at Runner Length ${L} mm` : ""}. Define the panels below and save it as a new spec — clear width isn&apos;t part of the spec, so this works at any clear width.
          </div>

          {draftPanels.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 rounded-md border border-grey-100 bg-light-600/60 p-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <MaterialReferenceSelect
                    category="furniture-component"
                    value={componentItems.find((c) => c.name === p.label)?.id ?? ""}
                    onChange={(id) => updateDraftPanel(p.id, { label: componentItems.find((c) => c.id === id)?.name ?? "" })}
                  />
                </div>
                {draftPanels.length > 1 && (
                  <button type="button" onClick={() => setDraftPanels((rows) => rows.filter((r) => r.id !== p.id))} aria-label="Remove panel" className="shrink-0 rounded-md p-2 text-grey-400 hover:bg-error-transparent hover:text-error">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Width formula *</Label>
                  <Input placeholder="e.g. W-10" value={p.widthFormula} onChange={(e) => updateDraftPanel(p.id, { widthFormula: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Height formula *</Label>
                  <Input placeholder="e.g. H-10" value={p.heightFormula} onChange={(e) => updateDraftPanel(p.id, { heightFormula: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Thickness *</Label>
                  <Input type="number" placeholder="e.g. 18mm" value={p.thickness} onChange={(e) => updateDraftPanel(p.id, { thickness: e.target.value === "" ? 0 : Number(e.target.value) })} />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setDraftPanels((rows) => [...rows, newPanel()])}
            className="flex items-center gap-1.5 self-start text-xs font-body font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add another panel
          </button>

          <Button type="button" onClick={saveDraftAsSpec} disabled={!draftValid} className="self-start">
            Save as Panel Spec
          </Button>
        </div>
      ) : null}

    </div>
  );
}
