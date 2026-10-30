"use client";

import { useState } from "react";
import { Download, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SelectField } from "@/components/shared/select-field";
import { PANEL_CALCULATOR_ROWS_KEY } from "@/components/shared/panel-calculator-context";
import { newBlankLine } from "@/components/purchase-orders/po-lines-table";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { usePanelCalcTickets, panelCalcTicketStore, ticketTime } from "@/lib/store/panel-calc-ticket-store";
import { toastStore } from "@/lib/store/toast-store";
import { evaluateFormula } from "@/lib/quote-pricing";
import { panelSqft, type PurchaseOrderLine } from "@/lib/purchase-order";
import type { FurnitureLineItem } from "@/lib/mock/unit-type";

// Purchase Order: "Import from Calculator" adds the rows of Purchase > Calculator's Other Panel table (kept in this browser,
// or a saved ticket) as
// Other Panel lines, made like the lines a Requirement Order gives a PO: panel name, cut width × height, thickness, qty, sq.ft and
// raw material. Rates come from the purchase price list as for any new line. The Calculator's table is left as it is.
export function PoImportFromCalculator({
  cabinets,
  defaults,
  nextPosition,
  onImport,
}: {
  // The PO's cabinets, to put the lines under one (or none: 0). space / code / unitName / type: the "+ Add cabinet" list's Space,
  // Code, Unit Name and Cabinet Type columns (unit no, name and space also head the cabinet's column).
  cabinets: { no: number; label: string; space?: string; code?: string; unitName?: string; type?: string }[];
  // Direct PO: the Cabinet Details card's material / finishes, as for rows added by hand.
  defaults?: Partial<PurchaseOrderLine>;
  nextPosition: number;
  onImport: (lines: PurchaseOrderLine[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tableRows, setTableRows] = useState<FurnitureLineItem[]>([]);
  // From: "table" (the Calculator's table on this computer) or a saved ticket's id.
  const [source, setSource] = useState("table");
  const tickets = usePanelCalcTickets();
  const rows = source === "table" ? tableRows : tickets.find((t) => t.id === source)?.rows ?? [];
  const [srNo, setSrNo] = useState(0);
  const components = useMaterialItems("furniture-component");
  const thicknesses = useMaterialItems("thickness");
  const rawMaterials = useMaterialItems("raw-material-type");
  const nameOf = (list: { id: string; name: string }[], id?: string) => list.find((m) => m.id === id)?.name ?? "";
  const size = (formula: string) => Math.round(evaluateFormula(formula, { W: 0, D: 0, H: 0 }));
  const usable = rows.filter((r) => size(r.widthFormula) && size(r.heightFormula));
  const totalOf = (r: FurnitureLineItem) => Math.max(1, r.qty || 1);

  // Two or more cabinets: a row's qty (often the cabinets' joint qty) is split by typing how many go to each cabinet column.
  // Columns are the cabinets picked with "+ Add cabinet" (starting with the first cabinet; × takes any one off, even the last). Every column
  // starts at 0 (all of a row's qty in "Left") and the qty for each cabinet is typed; qty given to no column isn't imported, and giving out more than the row's qty
  // blocks Import. One cabinet (or none): the single "Add to cabinet" choice, as before.
  const splitMode = cabinets.length > 1;
  const [split, setSplit] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<number[]>([]);
  const cols = picked.flatMap((no) => cabinets.filter((c) => c.no === no));
  // "+ Add cabinet": the cabinets without a column yet, as Unit No | Space | Code | Unit Name | Cabinet Type, searchable on all. Tick
  // several, then Add puts them in as columns (in Unit No order).
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [chosen, setChosen] = useState<number[]>([]);
  const closeAdd = () => { setAddOpen(false); setAddQuery(""); setChosen([]); };
  const addChosen = () => {
    setPicked((p) => [...p, ...cabinets.filter((c) => chosen.includes(c.no)).map((c) => c.no)]);
    closeAdd();
  };
  // A column's heading: "4. Base Unit Divider Panels With 2 Tandem Drawers", then space and code ("Kitchen-BUD2TD") on its own line.
  // A cabinet with no unit shows its cabinet type.
  const headName = (c: (typeof cabinets)[number]) => `${c.no}. ${c.unitName?.trim() || c.type || c.label.replace(/^\d+\.\s*/, "")}`;
  // Its last line: space and unit code, "Kitchen-BUDWS".
  const headPlace = (c: (typeof cabinets)[number]) => [c.space, c.code].filter(Boolean).join("-");
  const addable = cabinets
    .filter((c) => !picked.includes(c.no))
    .filter((c) => `${c.no} ${c.space ?? ""} ${c.code ?? ""} ${c.unitName ?? ""} ${c.type ?? ""}`.toLowerCase().includes(addQuery.trim().toLowerCase()));
  const qtyIn = (i: number, _r: FurnitureLineItem, no: number) => split[`${i}:${no}`] ?? 0;
  const leftOf = (i: number, r: FurnitureLineItem) => totalOf(r) - cols.reduce((sum, c) => sum + qtyIn(i, r, c.no), 0);
  const parts = splitMode
    ? cols.flatMap((c) => usable.map((r, i) => ({ r, no: c.no, qty: qtyIn(i, r, c.no) }))).filter((p) => p.qty > 0)
    : usable.map((r) => ({ r, no: srNo, qty: totalOf(r) }));
  const overGiven = splitMode && usable.some((r, i) => leftOf(i, r) < 0);
  const leftOut = splitMode ? usable.reduce((sum, r, i) => sum + Math.max(0, leftOf(i, r)), 0) : 0;
  const columns = ["minmax(9rem,1fr)", "7rem", "3.5rem", "3.5rem", ...(splitMode ? [...cols.map(() => "11rem"), "3.5rem"] : [])].join(" ");

  const openDialog = () => {
    let saved: FurnitureLineItem[] = [];
    try {
      saved = JSON.parse(window.localStorage.getItem(PANEL_CALCULATOR_ROWS_KEY) ?? "[]");
    } catch {
      // unreadable: treated as empty
    }
    const local = Array.isArray(saved) ? saved : [];
    setTableRows(local);
    setSource(local.length || !tickets.length ? "table" : tickets[0].id);
    void panelCalcTicketStore.refresh();
    setSrNo(cabinets[0]?.no ?? 0);
    setSplit({});
    setPicked(cabinets[0] ? [cabinets[0].no] : []);
    setOpen(true);
  };

  const importRows = () => {
    const lines = parts.map(({ r, no, qty }, i) => {
      const width = size(r.widthFormula);
      const height = size(r.heightFormula);
      return {
        ...newBlankLine("other-panel", no, "", nextPosition + i),
        ...defaults,
        description: nameOf(components, r.componentTypeId) || "Panel",
        width,
        height,
        qty,
        depth: parseFloat(nameOf(thicknesses, r.thicknessId)) || 0,
        sqft: panelSqft(width, height, qty),
        material: nameOf(rawMaterials, r.rawMaterialTypeId) || defaults?.material || "",
      };
    });
    onImport(lines);
    const from = tickets.find((t) => t.id === source);
    toastStore.show(`Imported ${lines.length} panel${lines.length === 1 ? "" : "s"} from ${from ? `Ticket ${from.no}` : "the Calculator"}`, "success");
    setOpen(false);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={openDialog}>
        <Download className="h-3.5 w-3.5" />
        Import from Calculator
      </Button>
      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className={`max-h-[85vh] overflow-y-auto ${splitMode ? "sm:max-w-6xl" : "sm:max-w-2xl"}`}>
            <DialogHeader>
              <DialogTitle>Import from Calculator</DialogTitle>
              <DialogDescription>The Other Panel rows of Purchase &gt; Panel Calculator (its table on this computer, or a saved ticket), added as Other Panel lines.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label>From</Label>
              <SelectField
                value={source}
                onChange={(e) => { setSource(e.target.value); setSplit({}); }}
                className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
              >
                <option value="table">Calculator table (this computer)</option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>Ticket {t.no} — {ticketTime(t.createdAt)}{t.createdBy ? ` — ${t.createdBy}` : ""}</option>
                ))}
              </SelectField>
            </div>
            {usable.length === 0 ? (
              <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">
                {source === "table"
                  ? "The Calculator's table is empty on this computer. Add panels in Purchase > Panel Calculator, or pick a saved ticket."
                  : "This ticket has no panels with a size."}
              </p>
            ) : (
              <>
                {cabinets.length === 1 && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Add to cabinet</Label>
                    <SelectField
                      value={String(srNo)}
                      onChange={(e) => setSrNo(Number(e.target.value))}
                      className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
                    >
                      {cabinets.map((c) => <option key={c.no} value={String(c.no)}>{c.label}</option>)}
                      <option value="0">No cabinet</option>
                    </SelectField>
                  </div>
                )}
                {splitMode && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-body text-grey-500">Add a column for each cabinet the panels go to, then type how many go to each.</p>
                    {cols.length < cabinets.length && (
                      <Popover open={addOpen} onOpenChange={(o) => (o ? setAddOpen(true) : closeAdd())}>
                        <PopoverTrigger className="flex h-8 items-center gap-1.5 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-primary hover:bg-primary-transparent">
                          <Plus className="h-3.5 w-3.5" />
                          Add cabinet
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-max min-w-80 max-w-[calc(100vw-2rem)] p-2">
                          <Input autoFocus placeholder="Search unit no, space, code, unit name or cabinet type" value={addQuery} onChange={(e) => setAddQuery(e.target.value)} />
                          <div className="grid grid-cols-[1.25rem_3.5rem_minmax(6rem,9rem)_minmax(5rem,7rem)_minmax(14rem,1fr)_minmax(10rem,16rem)] gap-2 rounded-md bg-[var(--table-head)] px-2 py-1.5 text-xs font-medium text-grey-900">
                            <span />
                            <span>Unit No</span>
                            <span>Space</span>
                            <span>Code</span>
                            <span>Unit Name</span>
                            <span>Cabinet Type</span>
                          </div>
                          <div className="flex max-h-72 flex-col overflow-y-auto">
                            {addable.map((c) => (
                              <label
                                key={c.no}
                                className={`grid cursor-pointer grid-cols-[1.25rem_3.5rem_minmax(6rem,9rem)_minmax(5rem,7rem)_minmax(14rem,1fr)_minmax(10rem,16rem)] items-center gap-2 rounded-md px-2 py-1.5 text-sm font-body text-grey-900 hover:bg-light-600 ${chosen.includes(c.no) ? "bg-primary-transparent" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  aria-label={`Add cabinet ${c.no}`}
                                  checked={chosen.includes(c.no)}
                                  onChange={(e) => setChosen((x) => (e.target.checked ? [...x, c.no] : x.filter((no) => no !== c.no)))}
                                  className="h-4 w-4 cursor-pointer accent-primary"
                                />
                                <span className="font-number font-semibold text-primary">{c.no}</span>
                                <span>{c.space || "—"}</span>
                                <span>{c.code || "—"}</span>
                                <span>{c.unitName || "—"}</span>
                                <span>{c.type || "—"}</span>
                              </label>
                            ))}
                            {addable.length === 0 && <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>}
                          </div>
                          <div className="flex items-center justify-end gap-2 border-t border-grey-100 pt-2">
                            <Button type="button" size="sm" variant="outline" onClick={closeAdd}>Cancel</Button>
                            <Button type="button" size="sm" disabled={chosen.length === 0} onClick={addChosen}>
                              {chosen.length ? `Add ${chosen.length} cabinet${chosen.length === 1 ? "" : "s"}` : "Add cabinets"}
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                )}
                <div className="overflow-x-auto rounded-md border border-grey-100">
                  <div className="w-max min-w-full">
                    <div style={{ gridTemplateColumns: columns }} className="table-head grid items-center gap-2 bg-[var(--table-head)] px-3 py-1.5 text-xs font-medium text-grey-900">
                      <span>Panel</span>
                      <span className="text-center">Width × Height</span>
                      <span className="text-center">Thk</span>
                      <span className="text-center">{splitMode ? "Total" : "Qty"}</span>
                      {splitMode && cols.map((c) => (
                        <span key={c.no} title={[headName(c), headPlace(c)].filter(Boolean).join(" · ")} className="flex min-w-0 items-center justify-center gap-0.5">
                          <span className="flex min-w-0 flex-col items-center text-center leading-snug">
                            <span className="line-clamp-2">{headName(c)}</span>
                            {headPlace(c) && <span className="text-grey-500">{headPlace(c)}</span>}
                          </span>
                          <button type="button" onClick={() => setPicked((p) => p.filter((no) => no !== c.no))} aria-label={`Remove column ${c.label}`} className="shrink-0 rounded p-0.5 text-grey-400 hover:bg-error-transparent hover:text-error">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {splitMode && <span className="text-center">Left</span>}
                    </div>
                    {usable.map((r, i) => {
                      const left = leftOf(i, r);
                      return (
                        <div key={`${i}-${r.id}`} style={{ gridTemplateColumns: columns }} className="grid items-center gap-2 border-t border-grey-100 px-3 py-1.5 text-sm">
                          <span className="truncate font-body text-grey-900">{nameOf(components, r.componentTypeId) || "Panel"}</span>
                          <span className="text-center font-number">{size(r.widthFormula)} × {size(r.heightFormula)}</span>
                          <span className="text-center font-number">{nameOf(thicknesses, r.thicknessId) || "—"}</span>
                          <span className="text-center font-number">{totalOf(r)}</span>
                          {splitMode && cols.map((c) => (
                            <Input
                              key={c.no}
                              type="number"
                              min={0}
                              aria-label={`${nameOf(components, r.componentTypeId) || "Panel"} qty for ${c.label}`}
                              value={qtyIn(i, r, c.no)}
                              onChange={(e) => setSplit((s) => ({ ...s, [`${i}:${c.no}`]: Math.max(0, Math.round(Number(e.target.value)) || 0) }))}
                              // Double-click: this box takes what's still Left (the whole Total when nothing is given out yet).
                              onDoubleClick={() => setSplit((s) => ({ ...s, [`${i}:${c.no}`]: qtyIn(i, r, c.no) + Math.max(0, left) }))}
                              title="Double-click to fill with the qty that's left"
                              className={`h-8 text-center font-number ${left < 0 ? "border-error" : ""}`}
                            />
                          ))}
                          {splitMode && (
                            <span className={`text-center font-number ${left < 0 ? "font-semibold text-error" : left > 0 ? "font-semibold text-orange" : "text-grey-400"}`}>{left}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {overGiven ? (
                  <p className="text-xs font-body text-error">A row gives out more than its Total. Lower a cabinet&apos;s qty to import.</p>
                ) : leftOut > 0 ? (
                  <p className="text-xs font-body text-orange">{leftOut} qty is left for no cabinet and won&apos;t be imported.</p>
                ) : null}
              </>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" disabled={parts.length === 0 || overGiven} onClick={importRows}>
                Import {parts.length} panel{parts.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
