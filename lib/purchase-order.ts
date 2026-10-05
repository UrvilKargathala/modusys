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
  gstMode: GstMode;
  roundOff: number;
  remarks: string;
  createdAt: string;
  lines: PurchaseOrderLine[];
};

// Panels are bought by area, hardware by piece.
export function lineAmount(l: Pick<PurchaseOrderLine, "group" | "rate" | "sqft" | "qty">): number {
  return l.rate * (l.group === "hardware" ? l.qty : l.sqft);
}

// Company is in Gujarat: same-state vendor → 9% state + 9% central, otherwise 18% IGST.
export const COMPANY_STATE = "Gujarat";
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
