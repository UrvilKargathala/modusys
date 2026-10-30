"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useArchitects } from "@/lib/store/architects-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { fullName } from "@/lib/mock/architects";
import { quoteRawTotal, quoteWaterfall } from "@/lib/quote-pricing";
import { quoteChanges } from "@/lib/quote-changes";
import type { Quote } from "@/lib/mock/quote";

// Saving an edited quote: shows what changed and asks for Remarks (required). Both go to the quote's History.
export function QuoteSaveRemarksDialog({
  before,
  after,
  onCancel,
  onSave,
}: {
  before: Quote;
  after: Quote;
  onCancel: () => void;
  onSave: (history: { remarks: string; changes: string[] }) => void;
}) {
  const [remarks, setRemarks] = useState("");
  const materials = useSyncExternalStore(materialSpecStore.subscribe, materialSpecStore.getSnapshot, materialSpecStore.getServerSnapshot);
  const customers = useCustomers();
  const architects = useArchitects();
  const users = useOrgUsers();
  const unitTypes = useUnitTypes();
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();

  const changes = useMemo(() => {
    const names = new Map<string, string>();
    for (const m of materials) names.set(m.id, m.name);
    for (const c of customers) names.set(c.id, c.name);
    for (const a of architects) names.set(a.id, fullName(a));
    for (const u of users) names.set(u.id, u.name);
    for (const t of unitTypes) names.set(t.id, t.shortCode ? `${t.shortCode} — ${t.name.trim()}` : t.name.trim());
    // Same Final Offer Amount as the Pricing Summary.
    const finalOf = (q: Quote) =>
      quoteWaterfall(quoteRawTotal(q.units, furnitureItems, hardwareItems), q.markupMultiplier, q.specialDiscountPct, q.installationFreightIncluded, q.installationFreightCost).finalOffer;
    return quoteChanges(before, after, (id) => names.get(id) ?? "", finalOf);
  }, [before, after, materials, customers, architects, users, unitTypes, furnitureItems, hardwareItems]);

  const ok = remarks.trim().length > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save changes to {after.quoteNumber}</DialogTitle>
          <DialogDescription>Type why the quote was changed. The remarks and the changes below are kept in the quote&apos;s History.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label>Changes ({changes.length})</Label>
          <ul className="max-h-56 overflow-y-auto rounded-md border border-grey-100 bg-light-600 px-4 py-2 text-sm font-body text-grey-700">
            {changes.map((c, i) => (
              <li key={i} className="list-disc py-0.5">{c}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quote-save-remarks">
            Remarks <span className="text-error">*</span>
          </Label>
          <textarea
            id="quote-save-remarks"
            autoFocus
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Customer asked for Blum hinges and a wider sink unit"
            className="rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={!ok} onClick={() => onSave({ remarks: remarks.trim(), changes })}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
