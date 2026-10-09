export type VendorContact = { name: string; phone: string };

export type Vendor = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  gst: string;
  code: string;
  contacts: VendorContact[];
  emails: string[];
  createdAt: string;
};

export type PoGroup = "carcass" | "shutter" | "other-panel" | "hardware";

export const PO_GROUPS: { key: PoGroup; code: string; label: string }[] = [
  { key: "carcass", code: "A", label: "Carcass" },
  { key: "shutter", code: "B", label: "Shutter" },
  { key: "other-panel", code: "C", label: "Other Panel" },
  { key: "hardware", code: "D", label: "Hardware" },
];

export type PurchaseOrderLine = {
  id: string;
  group: PoGroup;
  srNo: number;
  position: number;
  description: string;
  designType: string;
  width: number;
  depth: number;
  height: number;
  qty: number;
  sqft: number;
  internalColour: string;
  externalColour: string;
  material: string;
  articleNo: string;
  brand: string;
  category: string;
  unit: string;
  rate: number;
  // Hardware only: % off the rate (MRP). Panels always 0.
  discountPct?: number;
  remarks: string;
};

export type GstMode = "intra" | "inter";

// Pending until someone presses Mark as Completed.
export type PoStatus = "pending" | "completed";

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  poDate: string;
  requiredDate: string;
  vendorId: string;
  // Resolved server-side so a soft-deleted vendor still shows its name.
  vendorName: string;
  quoteId: string | null;
  customerId: string | null;
  discountPct: number;
  material: PoMaterial;
  gstMode: GstMode;
  status: PoStatus;
  roundOff: number;
  remarks: string;
  createdAt: string;
  lines: PurchaseOrderLine[];
};

export const SQMM_PER_SQFT = 92_903.04;

// Panel area in sq.ft from mm dimensions — same maths as the quote's groupSqFt.
export function panelSqft(width: number, height: number, qty: number): number {
  return (width * height * qty) / SQMM_PER_SQFT;
}

// The Material Description block of the sheet, snapshotted as text.
// Cabinet header shown above a cabinet's lines, keyed by cabinet no (the lines' srNo).
// Snapshot of the quote's unit + cabinet; kept inside the PO's `material` JSON so no extra table/column is needed.
export type PoCabinet = {
  label: string; // e.g. "Standard Cabinet"
  unitName: string; // unit type name
  space: string; // e.g. "Kitchen"
  width: number;
  depth: number;
  height: number;
  qty: number;
  // For Auto Populate: which cabinet type's formulas size this cabinet's carcass rows, and the unit's qty.
  cabinetTypeId: string;
  unitQty: number;
  // Design type picked from Purchase Material Library > Cabinet Type (name as text).
  designType?: string;
  remark?: string;
  design?: string;
  // Cabinet name picked in its own field from Purchase Material Library > Cabinet Name.
  cabinetName?: string;
  // This cabinet's own vendor (rates come from its prices); blank = the PO's vendor. Never changes the PO's Vendor section.
  vendorId?: string;
};

export type PoMaterial = {
  // Purchase Material Library > Purchase Product Type picked on the PO (its id); its Code goes into the PO number.
  productTypeId?: string;
  shutterRawMaterial: string;
  otherRawMaterial: string;
  cabinetRawMaterial: string;
  // Shutter / Cabinet Details finishes as picked there. Editing a row in the table doesn't change them.
  finishes?: Partial<Record<"shutterInternalColour" | "shutterExternalColour" | "cabinetInternalColour" | "cabinetExternalColour", string>>;
  cabinetOtherRawMaterial: string;
  // Derived from the lines' purchase internal/external finishes on save.
  internalColours: string[];
  externalColours: string[];
  cabinets: Record<string, PoCabinet>;
};

export const blankMaterial = (): PoMaterial => ({ shutterRawMaterial: "", otherRawMaterial: "", cabinetRawMaterial: "", cabinetOtherRawMaterial: "", internalColours: [], externalColours: [], cabinets: {} });

// Panels are bought by area, hardware by piece.
export function lineAmount(l: Pick<PurchaseOrderLine, "group" | "rate" | "sqft" | "qty" | "discountPct">): number {
  return l.group === "hardware" ? l.rate * (1 - (l.discountPct ?? 0) / 100) * l.qty : l.rate * l.sqft;
}

// Company is in Gujarat: same-state vendor → 9% state + 9% central, otherwise 18% IGST.
export const COMPANY_STATE = "Gujarat";
// Printed in the PO header; the Quote Template settings have no GST field.
export const COMPANY_GST = "24AAZFT9177A1ZM";
export function gstModeFor(vendorState: string): GstMode {
  return vendorState.trim().toLowerCase() === COMPANY_STATE.toLowerCase() ? "intra" : "inter";
}

export function poTotals(po: Pick<PurchaseOrder, "lines" | "discountPct" | "gstMode" | "roundOff">) {
  const amount = po.lines.reduce((s, l) => s + lineAmount(l), 0);
  const discount = (amount * po.discountPct) / 100;
  const taxable = amount - discount;
  const stateGst = po.gstMode === "intra" ? taxable * 0.09 : 0;
  const centralGst = po.gstMode === "intra" ? taxable * 0.09 : 0;
  const igst = po.gstMode === "inter" ? taxable * 0.18 : 0;
  const final = taxable + stateGst + centralGst + igst + po.roundOff;
  return { amount, discount, taxable, stateGst, centralGst, igst, final };
}

// Customer code: first two letters of the name + first two of the surname (Urvil Kargathala → URKA).
export function customerCodeFrom(firstName = "", lastName = "") {
  const two = (w: string) => w.replace(/[^a-z]/gi, "").slice(0, 2);
  return (two(firstName) + two(lastName)).toUpperCase();
}

// A customer's code: first two letters of the name + first two of the surname (Tejashbhai Patel → TEPA),
// falling back to the full name's first and last words when the surname is empty.
export function customerCode(c: { firstName?: string; lastName?: string; name: string }) {
  const words = c.name.trim().split(/\s+/);
  return c.lastName?.trim() ? customerCodeFrom(c.firstName || words[0], c.lastName) : customerCodeFrom(words[0], words.length > 1 ? words[words.length - 1] : "");
}

// PO-<vendor code>-<purchase product type code>-<customer code>-<id>, e.g. PO-VEN01-KT-TEPA-01. Missing parts are
// left out; the id counts up (01, 02 …) across POs that share the same parts.
export function poNumberBase(parts: (string | undefined)[]) {
  return ["PO", ...parts.map((p) => (p ?? "").trim().toUpperCase()).filter(Boolean)].join("-");
}
export function buildPoNumber(parts: (string | undefined)[], otherNumbers: string[]) {
  const base = poNumberBase(parts);
  const prefix = `${base}-`.toUpperCase();
  const max = otherNumbers.reduce((m, n) => {
    const u = n.toUpperCase();
    const id = u.startsWith(prefix) ? Number(u.slice(prefix.length)) : NaN;
    return Number.isInteger(id) ? Math.max(m, id) : m;
  }, 0);
  return `${base}-${String(max + 1).padStart(2, "0")}`;
}

// The value most rows use (first seen wins a tie); "" when none. Header pickers show this, so changing one row
// in the table doesn't blank the header.
export function mostUsed(values: string[]): string {
  const n = new Map<string, number>();
  for (const v of values) if (v) n.set(v, (n.get(v) ?? 0) + 1);
  let best = "";
  for (const [v, c] of n) if (c > (n.get(best) ?? 0)) best = v;
  return best;
}
