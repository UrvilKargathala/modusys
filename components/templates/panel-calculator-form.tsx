"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calculator, Copy, Pencil, Plus, Trash2, AlertCircle, History } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { usePanelCalcSpecs, panelCalcSpecStore } from "@/lib/store/panel-calc-spec-store";
import { usePanelCalcHistory, panelCalcHistoryStore } from "@/lib/store/panel-calc-history-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { evaluateFormula } from "@/lib/quote-pricing";
import type { PanelFormula } from "@/lib/mock/panel-calc-spec";

type ResultRow = { id: string; label: string; thickness: number; width: number; height: number };

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
    width: Math.round(evaluateFormula(toEvalFormula(p.widthFormula), vars)),
    height: Math.round(evaluateFormula(toEvalFormula(p.heightFormula), vars)),
  }));
}

export function PanelCalculatorForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const specs = usePanelCalcSpecs();
  const history = usePanelCalcHistory();
  const componentItems = useMaterialItems("furniture-component");

  const brands = useMemo(() => [...new Set(specs.map((s) => s.brand))].sort(), [specs]);
  const [brand, setBrand] = useState("");

  const products = useMemo(
    () => [...new Set(specs.filter((s) => s.brand === brand).map((s) => s.product))].sort(),
    [specs, brand]
  );
  const [product, setProduct] = useState("");

  const [width, setWidth] = useState<number | "">("");
  const [length, setLength] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");

  // Nothing computes until Calculate is clicked — typing dimensions doesn't
  // auto-search, and the "no spec found" build-your-own panels below only
  // appears after a real search comes back empty.
  const [searched, setSearched] = useState(false);
  const [matchedSpec, setMatchedSpec] = useState<(typeof specs)[number] | null>(null);
  const [draftPanels, setDraftPanels] = useState<PanelFormula[]>([]);

  const canCalculate = !!brand && !!product && width !== "" && length !== "" && height !== "";

  const runCalculate = () => {
    if (!canCalculate) return;
    // Width isn't stored on a spec — the same formulas apply at any width —
    // so the lookup key is Brand/Product/Length/Height only.
    const match = specs.find(
      (s) => s.brand === brand && s.product === product && s.length === length && s.height === height
    );
    setMatchedSpec(match ?? null);
    setSearched(true);
    setDraftPanels(match ? [] : [newPanel(), newPanel()]);

    if (match) {
      const rows = computeResults(match.panels, width, length, height);
      panelCalcHistoryStore.addEntry({ brand, product, width, length, height, panels: rows });
    }
  };

  const results: ResultRow[] | null = matchedSpec && width !== ""
    ? computeResults(matchedSpec.panels, width, matchedSpec.length, matchedSpec.height)
    : null;

  const copyResult = (r: ResultRow) => {
    navigator.clipboard.writeText(`${r.width} x ${r.height}`);
    toastStore.show(`${r.label} dimensions copied`, "success");
  };

  const editMatchedSpec = () => {
    if (!matchedSpec) return;
    const params = new URLSearchParams(searchParams);
    params.set("view", "specs");
    params.set("editId", matchedSpec.id);
    router.push(`${pathname}?${params.toString()}`);
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
    if (!draftValid || length === "" || height === "") return;
    const created = panelCalcSpecStore.createSpec({
      brand, product, length, height, description: "", panels: draftPanels,
    });
    toastStore.show(`Saved as a new Panel Spec`, "success");
    setMatchedSpec(created);
    setDraftPanels([]);

    if (width !== "") {
      const rows = computeResults(created.panels, width, length, height);
      panelCalcHistoryStore.addEntry({ brand, product, width, length, height, panels: rows });
    }
  };

  const copyHistoryEntry = (entry: (typeof history)[number]) => {
    const text = entry.panels.map((p) => `${p.label}: ${p.width} x ${p.height}`).join("\n");
    navigator.clipboard.writeText(text);
    toastStore.show("Calculation copied", "success");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label>Brand</Label>
          <select
            value={brand}
            onChange={(e) => { setBrand(e.target.value); setProduct(""); setSearched(false); setMatchedSpec(null); }}
            className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
          >
            <option value="">Select brand</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Product</Label>
          <select
            value={product}
            disabled={!brand}
            onChange={(e) => { setProduct(e.target.value); setSearched(false); setMatchedSpec(null); }}
            className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary disabled:bg-light-600 disabled:text-grey-300"
          >
            <option value="">Select product</option>
            {products.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Width (mm)</Label>
          <Input
            type="number"
            placeholder="e.g. 550"
            disabled={!product}
            value={width}
            onChange={(e) => { setWidth(e.target.value === "" ? "" : Number(e.target.value)); setSearched(false); setMatchedSpec(null); }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Length (mm)</Label>
          <Input
            type="number"
            placeholder="e.g. 450"
            disabled={!product}
            value={length}
            onChange={(e) => { setLength(e.target.value === "" ? "" : Number(e.target.value)); setSearched(false); setMatchedSpec(null); }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Height (mm)</Label>
          <Input
            type="number"
            placeholder="e.g. 100"
            disabled={!product}
            value={height}
            onChange={(e) => { setHeight(e.target.value === "" ? "" : Number(e.target.value)); setSearched(false); setMatchedSpec(null); }}
          />
        </div>
      </div>

      <Button type="button" onClick={runCalculate} disabled={!canCalculate} className="self-start">
        <Calculator className="h-4 w-4" />
        Calculate
      </Button>

      {!searched ? (
        <div className="rounded-lg border border-grey-100 bg-light-600 p-5">
          <div className="flex items-center gap-2 text-sm font-body text-grey-400">
            <Calculator className="h-4 w-4" />
            Select Brand, Product, Width, Length, and Height, then click Calculate.
          </div>
        </div>
      ) : matchedSpec ? (
        <div className="rounded-lg border border-grey-100 bg-card p-5">
          <div className="flex flex-col gap-3">
            {matchedSpec.description && (
              <p className="text-xs font-body text-grey-500">{matchedSpec.description}</p>
            )}
            <h4 className="font-heading text-sm font-semibold text-grey-900">Cutting Dimensions</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results!.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-grey-100 bg-light-600/60 px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-body font-medium text-grey-500">{r.label}</span>
                    <span className="font-number text-lg font-semibold text-grey-900">
                      {r.width} <span className="text-grey-300">×</span> {r.height} <span className="text-xs font-body text-grey-400">mm</span>
                      {r.thickness > 0 && <span className="text-xs font-body text-grey-400"> · {r.thickness}mm thick</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyResult(r)}
                      aria-label={`Copy ${r.label} dimensions`}
                      className="rounded-md p-2 text-grey-400 hover:bg-white hover:text-primary"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={editMatchedSpec}
                      aria-label={`Edit ${r.label} spec`}
                      className="rounded-md p-2 text-grey-400 hover:bg-white hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-dashed border-grey-200 p-5">
          <div className="flex items-center gap-2 text-sm font-body text-grey-500">
            <AlertCircle className="h-4 w-4 shrink-0 text-grey-300" />
            No panel spec found for {brand} {product} at {length}×{height} mm. Define the panels below and save it as a new spec — width isn&apos;t part of the spec, so this works at any width.
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
      )}

      {history.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <History className="h-4 w-4 text-grey-400" />
            <h4 className="font-heading text-sm font-semibold text-grey-900">Calculation History</h4>
            <span className="text-xs font-body text-grey-400">({history.length})</span>
          </div>
          <div className="flex flex-col gap-2">
            {[...history].reverse().map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-grey-100 bg-light-600/60 px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-body font-medium text-grey-500">
                    {entry.brand} {entry.product} — W{entry.width} × L{entry.length} × H{entry.height} mm
                  </span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {entry.panels.map((p) => (
                      <span key={p.id} className="font-number text-sm text-grey-900">
                        {p.label}: {p.width}×{p.height}{p.thickness > 0 && ` · ${p.thickness}mm`}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger
                      aria-label="Copy calculation"
                      onClick={() => copyHistoryEntry(entry)}
                      className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-white hover:text-primary"
                    >
                      <Copy className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>Copy</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      aria-label="Delete calculation"
                      onClick={() => panelCalcHistoryStore.deleteEntry(entry.id)}
                      className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-white hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
