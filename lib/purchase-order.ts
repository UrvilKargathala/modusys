export type VendorContact = { name: string; phone: string };

export type Vendor = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  gst: string;
  contacts: VendorContact[];
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
  remarks: string;
};

export type GstMode = "intra" | "inter";

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
};

export type PoMaterial = {
  shutterRawMaterial: string;
  otherRawMaterial: string;
  // Derived from the lines' purchase internal/external finishes on save.
  internalColours: string[];
  externalColours: string[];
  cabinets: Record<string, PoCabinet>;
};

export const blankMaterial = (): PoMaterial => ({ shutterRawMaterial: "", otherRawMaterial: "", internalColours: [], externalColours: [], cabinets: {} });

// Panels are bought by area, hardware by piece.
export function lineAmount(l: Pick<PurchaseOrderLine, "group" | "rate" | "sqft" | "qty">): number {
  return l.rate * (l.group === "hardware" ? l.qty : l.sqft);
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
