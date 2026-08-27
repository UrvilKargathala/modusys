"use client";

import { useMemo, useState } from "react";
import { Calculator, Copy, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { usePanelCalcSpecs } from "@/lib/store/panel-calc-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { evaluateFormula } from "@/lib/quote-pricing";

type ResultRow = { id: string; label: string; thickness: number; width: number; height: number };

export function PanelCalculatorForm() {
  const specs = usePanelCalcSpecs();

  const brands = useMemo(() => [...new Set(specs.map((s) => s.brand))].sort(), [specs]);
  const [brand, setBrand] = useState("");

  const products = useMemo(
    () => [...new Set(specs.filter((s) => s.brand === brand).map((s) => s.product))].sort(),
    [specs, brand]
  );
  const [product, setProduct] = useState("");

  const lengths = useMemo(
    () => [...new Set(specs.filter((s) => s.brand === brand && s.product === product).map((s) => s.length))].sort((a, b) => a - b),
    [specs, brand, product]
  );
  const [length, setLength] = useState<number | "">("");

  const heights = useMemo(
    () =>
      [...new Set(specs.filter((s) => s.brand === brand && s.product === product && s.length === length).map((s) => s.height))].sort(
        (a, b) => a - b
      ),
    [specs, brand, product, length]
  );
  const [height, setHeight] = useState<number | "">("");

  const matchedSpec = specs.find(
    (s) => s.brand === brand && s.product === product && s.length === length && s.height === height
  );

  const results: ResultRow[] | null = matchedSpec
    ? (() => {
        const vars = { W: matchedSpec.length, D: 0, H: matchedSpec.height };
        return matchedSpec.panels.map((p) => ({
          id: p.id,
          label: p.label,
          thickness: p.thickness,
          width: Math.round(evaluateFormula(p.widthFormula, vars)),
          height: Math.round(evaluateFormula(p.heightFormula, vars)),
        }));
      })()
    : null;

  const copyResult = (r: ResultRow) => {
    navigator.clipboard.writeText(`${r.width} x ${r.height}`);
    toastStore.show(`${r.label} dimensions copied`, "success");
  };

  if (specs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-grey-200 py-12 text-center">
        <AlertCircle className="h-6 w-6 text-grey-300" />
        <p className="text-sm font-body text-grey-500">
          No panel specs configured yet. Add panel formulas under the &quot;Panel Specs&quot; tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label>Brand</Label>
          <select
            value={brand}
            onChange={(e) => { setBrand(e.target.value); setProduct(""); setLength(""); setHeight(""); }}
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
            onChange={(e) => { setProduct(e.target.value); setLength(""); setHeight(""); }}
            className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary disabled:bg-light-600 disabled:text-grey-300"
          >
            <option value="">Select product</option>
            {products.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Length</Label>
          <select
            value={length}
            disabled={!product}
            onChange={(e) => { setLength(e.target.value ? Number(e.target.value) : ""); setHeight(""); }}
            className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary disabled:bg-light-600 disabled:text-grey-300"
          >
            <option value="">Select length</option>
            {lengths.map((l) => <option key={l} value={l}>{l} mm</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Height</Label>
          <select
            value={height}
            disabled={length === ""}
            onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : "")}
            className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary disabled:bg-light-600 disabled:text-grey-300"
          >
            <option value="">Select height</option>
            {heights.map((h) => <option key={h} value={h}>{h} mm</option>)}
          </select>
        </div>
      </div>

      <div className={results ? "rounded-lg border border-grey-100 bg-card p-5" : "rounded-lg border border-grey-100 bg-light-600 p-5"}>
        {!results ? (
          <div className="flex items-center gap-2 text-sm font-body text-grey-400">
            <Calculator className="h-4 w-4" />
            Select Brand, Product, Length, and Height to look up panel dimensions.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {matchedSpec?.description && (
              <p className="text-xs font-body text-grey-500">{matchedSpec.description}</p>
            )}
            <h4 className="font-heading text-sm font-semibold text-grey-900">Cutting Dimensions</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-grey-100 bg-light-600/60 px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-body font-medium text-grey-500">{r.label}</span>
                    <span className="font-number text-lg font-semibold text-grey-900">
                      {r.width} <span className="text-grey-300">×</span> {r.height} <span className="text-xs font-body text-grey-400">mm</span>
                      {r.thickness > 0 && <span className="text-xs font-body text-grey-400"> · {r.thickness}mm thick</span>}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyResult(r)}
                    aria-label={`Copy ${r.label} dimensions`}
                    className="rounded-md p-2 text-grey-400 hover:bg-white hover:text-primary"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
