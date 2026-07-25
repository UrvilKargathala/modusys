"use client";

import { useMemo } from "react";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import {
  evaluateFormula,
  furnitureLineTotal,
  hardwareLineTotal,
  SQMM_PER_SQFT,
} from "@/lib/quote-pricing";
import { formatInr } from "@/lib/format";
import type { Quote } from "@/lib/mock/quote";
import type { FurnitureLineItem } from "@/lib/mock/unit-type";

// Grand totals per line-item kind across every unit/cabinet in the quote.
// Amounts scale by unit.qty so multi-quantity units contribute correctly.
function computeTotals(
  quote: Quote,
  furnitureItems: ReturnType<typeof useFurniturePriceItems>,
  hardwareItems: ReturnType<typeof useHardwarePriceItems>
) {
  const acc = { carcassSqft: 0, carcassAmt: 0, shutterSqft: 0, shutterAmt: 0, hardwareAmt: 0 };

  const addFurniture = (item: FurnitureLineItem, unit: Quote["units"][number], target: "carcass" | "shutter") => {
    const w = evaluateFormula(item.widthFormula, { W: unit.width, D: unit.depth, H: unit.height });
    const h = evaluateFormula(item.heightFormula, { W: unit.width, D: unit.depth, H: unit.height });
    const sqft = ((w * h) / SQMM_PER_SQFT) * item.qty * unit.qty;
    const amt = furnitureLineTotal(item, unit, furnitureItems) * unit.qty;
    if (target === "carcass") { acc.carcassSqft += sqft; acc.carcassAmt += amt; }
    else { acc.shutterSqft += sqft; acc.shutterAmt += amt; }
  };

  for (const unit of quote.units) {
    for (const cabinet of unit.cabinets) {
      cabinet.components.forEach((c) => addFurniture(c, unit, "carcass"));
      cabinet.externalFinishes.forEach((c) => addFurniture(c, unit, "shutter"));
      for (const hw of cabinet.hardware) {
        acc.hardwareAmt += hardwareLineTotal(hw, unit, hardwareItems) * unit.qty;
      }
    }
  }
  return acc;
}

export function CategorySummary({ quote }: { quote: Quote }) {
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();
  const totals = useMemo(
    () => computeTotals(quote, furnitureItems, hardwareItems),
    [quote, furnitureItems, hardwareItems]
  );

  const combined = totals.carcassAmt + totals.shutterAmt + totals.hardwareAmt;
  const fmtSqft = (n: number) => (n ? n.toFixed(3) : "—");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold text-grey-900">Category Summary</h2>
      <div className="overflow-x-auto rounded-lg border border-grey-100">
        <table className="w-full text-left">
          <thead className="bg-light-600">
            <tr>
              <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                Category
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                Sq.ft
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-grey-100">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">Carcass Total</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-body text-grey-500">{fmtSqft(totals.carcassSqft)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-body font-semibold text-grey-800">
                {formatInr(totals.carcassAmt)}
              </td>
            </tr>
            <tr className="border-t border-grey-100">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">Shutter Total</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-body text-grey-500">{fmtSqft(totals.shutterSqft)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-body font-semibold text-grey-800">
                {formatInr(totals.shutterAmt)}
              </td>
            </tr>
            <tr className="border-t border-grey-100">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">Hardware Total</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-body text-grey-500">—</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-body font-semibold text-grey-800">
                {formatInr(totals.hardwareAmt)}
              </td>
            </tr>
            <tr className="border-t-2 border-grey-100 bg-light-600/40">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body font-semibold text-grey-900">Combined Total</td>
              <td className="whitespace-nowrap px-4 py-3" />
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-body font-semibold text-grey-900">
                {formatInr(combined)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
