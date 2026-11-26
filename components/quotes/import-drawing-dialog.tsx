"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { autoPopulateCabinets } from "@/lib/auto-populate";
import { blankQuoteUnit, type Quote, type QuoteUnit } from "@/lib/mock/quote";
import type { UnitTypeHardware } from "@/lib/mock/unit-type";
import { rateAfterDiscount } from "@/lib/mock/pricing-list";
import { normalizeVariantId } from "@/lib/variant-id";
import { KITCHEN_ACCESSORIES, LIGHT_UNIT, type Draft, type FinalDraft } from "@/lib/drawing-import";

// Quotes → New → Import from drawing (docs/PDF_TO_QUOTE_PLAN.md): upload the layout + elevation PDF, Claude reads it
// (/api/quotes/import-drawing), staff look over the result here, then "Fill quote" puts the Material Specification
// and the units into the draft, each unit Auto Populated exactly as its button would. Nothing is saved until Save Quote.

type ImportResult = { final: FinalDraft; spec: Draft["spec"]; excluded: Draft["excluded"]; seconds: number };
type Step = { kind: "pick" } | { kind: "reading" } | { kind: "review"; result: ImportResult } | { kind: "error"; message: string };

export function ImportDrawingDialog({
  open,
  onOpenChange,
  unitsInDraft,
  onFill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitsInDraft: number;
  onFill: (patch: Partial<Quote>, toCheck: number) => void;
}) {
  const unitTypes = useUnitTypes();
  const cabinetTypes = useCabinetTypes();
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [seconds, setSeconds] = useState(0);
  const abort = useRef<AbortController | null>(null);

  // A running count while Claude reads, so a 1–2 minute wait doesn't look stuck.
  useEffect(() => {
    if (step.kind !== "reading") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [step.kind]);

  const close = (next: boolean) => {
    if (!next) {
      abort.current?.abort();
      setStep({ kind: "pick" });
      setFile(null);
    }
    onOpenChange(next);
  };

  const read = async () => {
    if (!file) return;
    abort.current = new AbortController();
    setSeconds(0);
    setStep({ kind: "reading" });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/quotes/import-drawing", { method: "POST", body, signal: abort.current.signal });
      const json = await res.json().catch(() => ({ error: `The server answered ${res.status}` }));
      if (!res.ok || json.error) return setStep({ kind: "error", message: json.error ?? "Could not read the drawing" });
      setStep({ kind: "review", result: json as ImportResult });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setStep({ kind: "error", message: "Could not reach the server. Check the connection and try again." });
    }
  };

  const description = (h: UnitTypeHardware) => h.description || hardwareItems.find((x) => x.id === h.hardwareItemId)?.description || "";

  const toQuotePatch = ({ final }: ImportResult): Partial<Quote> => {
    const price = final.spec.variant
      ? furnitureItems.find((i) => !i.deleted && normalizeVariantId(i.variantId) === normalizeVariantId(final.spec.variant!.variantId))
      : undefined;
    // Same five fields the Variant ID picker sets.
    const shutter = price
      ? {
          shutterFinishId: price.externalColourId,
          shutterFinishThicknessId: price.thicknessId,
          shutterFinishRawMaterialId: price.rawMaterialTypeId,
          shutterFinishInternalColourId: price.internalColourId,
          shutterFinishExternalColourId: price.externalColourId,
        }
      : {};
    const ctx = {
      cabinetTypeName: (id: string) => cabinetTypes.find((c) => c.id === id)?.name ?? "Cabinet",
      hardwareItems,
      furnitureItems,
      shutterFinishId: shutter.shutterFinishId ?? "",
      shutterFinishOverrides: shutter,
    };
    const makeUnit = (unitTypeId: string | null, spaceId: string, size: { width: number; depth: number; height: number }, remark: string): QuoteUnit => {
      const unit = { ...blankQuoteUnit(), unitTypeId, spaceId, ...size, qty: 1, collapsed: true, remark };
      const type = unitTypes.find((t) => t.id === unitTypeId);
      return type ? { ...unit, cabinets: autoPopulateCabinets(type, { ...size, qty: 1 }, ctx), autoPopulated: true } : unit;
    };

    const units = final.units.map((u) => makeUnit(u.unitTypeId, u.spaceId ?? "", { width: u.width, depth: u.depth, height: u.height }, u.flags.join("; ")));
    const spaceId = final.units.find((u) => u.spaceId)?.spaceId ?? "";
    const none = { width: 0, depth: 0, height: 0 };
    const typeId = (name: string) => unitTypes.find((t) => t.name.trim() === name)?.id;

    const accessoriesId = typeId(KITCHEN_ACCESSORIES);
    if (accessoriesId) {
      const unit = makeUnit(accessoriesId, spaceId, none, "");
      // Keep only the cutlery tray that fits the drawer under the hob (all of them when that drawer wasn't found).
      const trayMm = (h: UnitTypeHardware) => Number(/Cutlery Tray\s*(\d+)\s*mm/i.exec(description(h))?.[1] ?? NaN);
      const cabinets = unit.cabinets.map((c) => ({
        ...c,
        hardware: c.hardware.filter((h) => Number.isNaN(trayMm(h)) || final.cutleryTrayMm === null || trayMm(h) === final.cutleryTrayMm),
      }));
      const agent = hardwareItems.find((h) => !h.deleted && /cleaning agent/i.test(h.description));
      const hasAgent = cabinets.some((c) => c.hardware.some((h) => /cleaning agent/i.test(description(h))));
      if (final.cleaningAgent && agent && !hasAgent && cabinets[0]) {
        cabinets[0] = {
          ...cabinets[0],
          hardware: [
            ...cabinets[0].hardware,
            {
              id: `qhw-${agent.id}-${cabinets[0].hardware.length}`,
              categoryId: agent.categoryId,
              hardwareItemId: agent.id,
              qtyFormula: "1",
              articleNo: agent.articleNo,
              brandId: agent.brandId,
              description: agent.description,
              levelTypeId: agent.levelTypeId,
              rateOverride: rateAfterDiscount(agent),
            },
          ],
        };
      }
      units.push({ ...unit, cabinets });
    }

    const lightId = typeId(LIGHT_UNIT);
    if (lightId) {
      const unit = makeUnit(lightId, spaceId, none, "");
      // The LED strip is priced per mm: its qty is the length added up from the drawing.
      const cabinets = unit.cabinets.map((c) => ({
        ...c,
        hardware: c.hardware.map((h) => /LED Strip/i.test(description(h))
            ? { ...h, qtyFormula: String(final.ledMm), qtyNote: undefined }
            : /Spot Light/i.test(description(h)) && final.spotLights > 0
              ? { ...h, qtyFormula: String(final.spotLights), qtyNote: undefined }
              : h),
      }));
      units.push({ ...unit, cabinets });
    }

    const s = final.spec;
    return {
      ...(s.productTypeId && { productTypeId: s.productTypeId }),
      ...(s.materialDescriptionId && { materialDescriptionId: s.materialDescriptionId }),
      ...(s.handleTypeId && { handleTypeId: s.handleTypeId }),
      ...(s.hingesTypeId && { hingesTypeId: s.hingesTypeId }),
      ...(s.tandemDrawerTypeId && { tandemDrawerTypeId: s.tandemDrawerTypeId }),
      ...shutter,
      units,
    };
  };

  const fill = (result: ImportResult) => {
    const toCheck = result.final.units.filter((u) => u.flags.length > 0).length + result.final.flags.length;
    onFill(toQuotePatch(result), toCheck);
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => step.kind !== "reading" && close(o)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import from drawing</DialogTitle>
          <DialogDescription>
            Upload the layout and elevation PDF. Claude reads it in 1–5 minutes (bigger kitchens take longer) and fills the Material Specification and Units.
            Customer details stay as they are.
          </DialogDescription>
        </DialogHeader>

        {(step.kind === "pick" || step.kind === "error") && (
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-grey-200 bg-light-600 px-4 py-6 text-sm font-body text-grey-700 hover:border-primary">
              <FileUp className="h-5 w-5 text-primary" />
              <span className="min-w-0 truncate">{file ? file.name : "Choose the drawing PDF"}</span>
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setStep({ kind: "pick" });
                }}
              />
            </label>
            {unitsInDraft > 0 && (
              <p className="text-sm font-body text-grey-500">This replaces the {unitsInDraft} unit{unitsInDraft === 1 ? "" : "s"} already in this draft.</p>
            )}
            {step.kind === "error" && <p className="text-sm font-body text-error">{step.message}</p>}
          </div>
        )}

        {step.kind === "reading" && (
          <div className="flex items-center gap-3 py-8 text-sm font-body text-grey-700">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Reading the drawing… {seconds} s
          </div>
        )}

        {step.kind === "review" && <Review result={step.result} />}

        <DialogFooter>
          {step.kind === "review" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep({ kind: "pick" })}>
                Back
              </Button>
              <Button type="button" onClick={() => fill(step.result)}>
                Fill quote
              </Button>
            </>
          ) : step.kind === "reading" ? (
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
          ) : (
            <Button type="button" disabled={!file} onClick={read}>
              Read drawing
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Review({ result }: { result: ImportResult }) {
  const { final, spec } = result;
  const rows: [string, string][] = [
    ["Product Type", spec.productType],
    ["Cabinet Description", spec.cabinetDescription],
    ["Variant ID", final.spec.variant ? final.spec.variant.variantId : `"${spec.variantIdText}": pick by hand`],
    ["Handle", spec.handle],
    ["Tandem Drawer", spec.tandemDrawerType],
    ["Hinges", spec.hinges],
  ];
  return (
    <div className="flex flex-col gap-4 text-sm font-body">
      <div className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg border border-grey-100 bg-light-600 px-4 py-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <span className="text-grey-500">{label}</span>
            <span className="text-right text-grey-900">{value}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-grey-100">
        <table className="w-full text-left">
          <thead className="bg-light-600 text-xs text-grey-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Unit Type</th>
              <th className="px-3 py-2 text-right">W × D × H</th>
              <th className="px-3 py-2">Check</th>
            </tr>
          </thead>
          <tbody>
            {final.units.map((u) => (
              <tr key={u.order} className="border-t border-grey-100 align-top">
                <td className="px-3 py-2 font-number text-grey-500">{u.order}</td>
                <td className="px-3 py-2 text-grey-900">{u.unitType}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-number text-grey-900">
                  {u.width} × {u.depth} × {u.height}
                </td>
                <td className="px-3 py-2 text-warning">{u.flags.join("; ")}</td>
              </tr>
            ))}
            <tr className="border-t border-grey-100">
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-grey-900" colSpan={3}>
                {KITCHEN_ACCESSORIES} (cutlery tray {final.cutleryTrayMm ?? "?"} mm{final.cleaningAgent ? ", cleaning agent" : ""}) · {LIGHT_UNIT} (LED {final.ledMm} mm, {final.spotLights} spot lights)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {final.flags.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-lg border border-warning-300 bg-warning-100 px-4 py-3 text-grey-800">
          {final.flags.map((f, i) => (
            <li key={i} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              {f}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-grey-500">
        Left out: {result.excluded.map((x) => x.label).join(", ") || "nothing"}. Read in {result.seconds} s.
      </p>
    </div>
  );
}
