import type { Quote, QuoteUnit } from "@/lib/mock/quote";
import { statusConfig, type StatusKey } from "@/lib/status";

// What changed between the saved quote and the edited one, as lines for the quote's History ("Handle: Hettich → Blum").
// nameOf turns an id (customer, material item, user, unit type…) into its name; finalOf gives a quote's Final Offer amount.
// UI-only state (a unit's collapsed / autoPopulated) is ignored.

const FIELDS: [keyof Quote, string][] = [
  ["quoteNumber", "Quote No"],
  ["date", "Date"],
  ["customerId", "Customer"],
  ["architectId", "Architect"],
  ["propertyTypeId", "Property Type"],
  ["salesExecutiveId", "Sales Executive"],
  ["designerId", "Designer"],
  ["siteEngineerId", "Site Engineer"],
  ["productTypeId", "Product Type"],
  ["materialDescriptionId", "Cabinet Description"],
  ["shutterFinishId", "Variant ID"],
  ["shutterFinishThicknessId", "Shutter Thickness"],
  ["shutterFinishRawMaterialId", "Shutter Raw Material"],
  ["shutterFinishInternalColourId", "Shutter Internal Colour"],
  ["shutterFinishExternalColourId", "Shutter External Colour"],
  ["handleTypeId", "Handle"],
  ["hingesTypeId", "Hinges"],
  ["clientResponsibilityId", "Client Responsibility"],
  ["tandemDrawerTypeId", "Tandem Drawer Type"],
];

const SECTIONS = [
  ["components", "Carcass"],
  ["externalFinishes", "Shutter"],
  ["panels", "Other Panel"],
  ["hardware", "Hardware"],
] as const;

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function quoteChanges(before: Quote, after: Quote, nameOf: (id: string) => string, finalOf: (q: Quote) => number): string[] {
  const out: string[] = [];
  const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : nameOf(String(v)) || String(v));

  for (const [key, label] of FIELDS) {
    if (!same(before[key] ?? "", after[key] ?? "")) out.push(`${label}: ${show(before[key])} → ${show(after[key])}`);
  }
  if (before.status !== after.status) {
    const s = (k: string) => statusConfig[k as StatusKey]?.label ?? k;
    out.push(`Status: ${s(before.status)} → ${s(after.status)}`);
  }
  if (before.markupMultiplier !== after.markupMultiplier) out.push(`Markup: ${before.markupMultiplier} → ${after.markupMultiplier}`);
  if (before.specialDiscountPct !== after.specialDiscountPct) out.push(`Special Discount: ${before.specialDiscountPct}% → ${after.specialDiscountPct}%`);
  if (before.installationFreightIncluded !== after.installationFreightIncluded) {
    const yn = (v: boolean) => (v ? "Included" : "Not included");
    out.push(`Installation & Freight: ${yn(before.installationFreightIncluded)} → ${yn(after.installationFreightIncluded)}`);
  }
  if ((before.installationFreightCost ?? 0) !== (after.installationFreightCost ?? 0)) {
    out.push(`Installation & Freight cost: ${inr(before.installationFreightCost ?? 0)} → ${inr(after.installationFreightCost ?? 0)}`);
  }
  if ((before.remark ?? "") !== (after.remark ?? "")) out.push("Remark changed");
  if (!same(before.finishOptions ?? [], after.finishOptions ?? [])) {
    out.push(`Finish Options changed (${(before.finishOptions ?? []).length} → ${(after.finishOptions ?? []).length})`);
  }

  // Units, matched by id: added, removed, or what changed inside one.
  const unitLabel = (u: QuoteUnit, i: number) => `${i + 1}. ${[u.spaceId ? nameOf(u.spaceId) : "", u.unitTypeId ? nameOf(u.unitTypeId) : ""].filter(Boolean).join(" — ") || "Unit"}`;
  const oldById = new Map(before.units.map((u, i) => [u.id, { u, i }]));
  const newIds = new Set(after.units.map((u) => u.id));
  before.units.forEach((u, i) => {
    if (!newIds.has(u.id)) out.push(`Unit removed: ${unitLabel(u, i)}`);
  });
  after.units.forEach((u, i) => {
    const old = oldById.get(u.id);
    if (!old) {
      out.push(`Unit added: ${unitLabel(u, i)}`);
      return;
    }
    const parts: string[] = [];
    if (old.u.spaceId !== u.spaceId) parts.push(`Space ${show(old.u.spaceId)} → ${show(u.spaceId)}`);
    if (old.u.unitTypeId !== u.unitTypeId) parts.push(`Unit Type ${show(old.u.unitTypeId)} → ${show(u.unitTypeId)}`);
    for (const [k, label] of [["width", "Width"], ["depth", "Depth"], ["height", "Height"], ["qty", "Qty"]] as const) {
      if (old.u[k] !== u[k]) parts.push(`${label} ${old.u[k]} → ${u[k]}`);
    }
    if (old.u.cabinets.length !== u.cabinets.length) parts.push(`Cabinets ${old.u.cabinets.length} → ${u.cabinets.length}`);
    for (const [key, label] of SECTIONS) {
      // Row ids are left out: Auto Populate makes new rows with new ids, which is only a change if their contents differ.
      const rows = (x: QuoteUnit) => x.cabinets.flatMap((c) => (c[key] ?? []) as { id: string }[]).map(({ id: _id, ...r }) => r);
      const a = rows(old.u);
      const b = rows(u);
      if (!same(a, b)) parts.push(a.length === b.length ? `${label} changed` : `${label} ${a.length} → ${b.length} rows`);
    }
    if ((old.u.remark ?? "") !== (u.remark ?? "")) parts.push("remark changed");
    if (parts.length) out.push(`Unit ${unitLabel(u, i)}: ${parts.join(", ")}`);
  });
  const kept = after.units.filter((u) => oldById.has(u.id)).map((u) => u.id);
  if (!same(kept, before.units.filter((u) => newIds.has(u.id)).map((u) => u.id))) out.push("Units reordered");

  const a = finalOf(before);
  const b = finalOf(after);
  if (Math.abs(a - b) >= 0.005) out.push(`Final Amount: ${inr(a)} → ${inr(b)}`);
  return out;
}
