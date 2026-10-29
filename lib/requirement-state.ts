"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Quote } from "@/lib/mock/quote";
import type { PurchaseOrder } from "@/lib/purchase-order";
import { buildPoFromQuote } from "@/lib/purchase-order-from-quote";
import { requirementProgress, sentLines } from "@/lib/requirement-progress";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useHardwarePriceItems } from "@/lib/store/pricing-list-store";

type Ctx = Parameters<typeof buildPoFromQuote>[1];

// A Requirement Order's lines that can go to a PO (built exactly as a PO is built, each tagged with its line id: a panel needs a size,
// hardware a qty), which of them are on a PO already, and the order's progress.
export function requirementState(ro: { id: string; quoteId: string; data: Quote }, orders: PurchaseOrder[], ctx: Ctx) {
  const built = buildPoFromQuote(ro.data, ctx);
  const ids = [...new Set(built.lines.map((l) => l.sourceId ?? "").filter(Boolean))];
  const sent = sentLines(ro.id, ro.quoteId, orders, ids);
  return { built, ids, sent, progress: requirementProgress(ids, sent) };
}

// What buildPoFromQuote reads (library names, unit types, hardware prices), kept live.
export function useBuildCtx(): Ctx {
  const materials = useSyncExternalStore(materialSpecStore.subscribe, materialSpecStore.getSnapshot, materialSpecStore.getServerSnapshot);
  const unitTypes = useUnitTypes();
  const hardwareItems = useHardwarePriceItems();
  return useMemo(() => ({ materials, unitTypes, hardwareItems }), [materials, unitTypes, hardwareItems]);
}
