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
  // "vendor" (default) or "dealer" (Proforma Invoices keep their own dealer list).
  kind?: "vendor" | "dealer";
  // Dealer details (Proforma Invoices).
  category?: string;
  area?: string;
  salesPerson?: string;
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
  // Panel rows: this row's own vendor; blank/absent = the cabinet's vendor, else the PO's.
  vendorId?: string;
};

export type GstMode = "intra" | "inter";

// Pending until someone presses Mark as Completed.
// Built-in statuses; a PO may also carry any status name someone typed ("Add status"). So a status is plain text: the built-in key
// (pending, confirmed, in-production, delivered) or the typed name.
export type PoStatus = string;
export const DIRECT_PO_STATUSES: PoStatus[] = ["pending", "confirmed", "in-production", "delivered"];
// Purchase Orders and Direct Purchase Orders share one set.
export const PO_STATUSES: PoStatus[] = DIRECT_PO_STATUSES;
export const PO_STATUS_LABEL: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", "in-production": "In Production", delivered: "Delivered" };
// Older POs saved as Part Completed / Completed read as In Production / Delivered; nothing stored is rewritten.
const LEGACY_STATUS: Record<string, PoStatus> = { "part-completed": "in-production", completed: "delivered" };
export const asPoStatus = (s: unknown): PoStatus => {
  const t = typeof s === "string" ? s.trim().slice(0, 40) : "";
  if (!t) return "pending";
  const key = t.toLowerCase().replace(/\s+/g, "-");
  if (LEGACY_STATUS[key]) return LEGACY_STATUS[key];
  return DIRECT_PO_STATUSES.includes(key) ? key : t;
};
export const poStatusLabel = (s: string) => PO_STATUS_LABEL[asPoStatus(s)] ?? asPoStatus(s);
// The built-in statuses, then the ones added in Purchase Material Library > Purchase Order Status, then any other status name still in
// use on these POs (for example one that was renamed or deleted in the library), in the order first seen.
export const poStatusList = (orders: { status: string }[], added: string[] = []): PoStatus[] => [...new Set([...DIRECT_PO_STATUSES, ...added.map((a) => asPoStatus(a)), ...orders.map((o) => asPoStatus(o.status))])];
// One pill colour per status: pending yellow, confirmed indigo, in production yellow, delivered teal; a status someone added is grey.
// A soft fill, a border in the colour and dark text, so the label stays readable.
const PO_STATUS_STYLES: Record<string, string> = {
  pending: "border border-warning bg-warning-200 font-semibold text-grey-900",
  confirmed: "border border-indigo bg-indigo-200 font-semibold text-grey-900",
  "in-production": "border border-warning bg-warning-200 font-semibold text-grey-900",
  delivered: "border border-teal bg-teal-200 font-semibold text-grey-900",
};
export const poStatusStyle = (s: string) => PO_STATUS_STYLES[asPoStatus(s)] ?? "border border-grey-200 bg-grey-100 font-semibold text-grey-900";
export const PO_STATUS_STYLE = new Proxy(PO_STATUS_STYLES, { get: (t, k: string) => t[k] ?? poStatusStyle(k) }) as Record<string, string>;

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
  // Carcass finishes / material picked on the cabinet before it has rows (a Direct PO); new carcass rows take them.
  internalColour?: string;
  externalColour?: string;
  material?: string;
  // This cabinet's own "Components visible" tick; unset = follow the Unit Type's tick.
  componentsVisible?: boolean;
};

export type PoMaterial = {
  // A Direct Purchase Order (not from a quote): listed under Direct Purchase Orders, not under Purchase Orders.
  direct?: boolean;
  // A Proforma Invoice: a copy of a Direct Purchase Order kept in its own list (it is also marked direct, so it behaves like one).
  proforma?: boolean;
  // Approximate delivery date (yyyy-mm-dd), typed on the PO.
  approxDeliveryDate?: string;
  // A tick to mark the row in the Order Tracker Excel.
  highlight?: boolean;
  // Order Tracker columns: the Purchase Order Type (name picked from the Purchase Material Library) and the vendor's proforma invoice.
  orderType?: string;
  vendorPiNo?: string;
  vendorPiDate?: string;
  vendorPiAmount?: number;
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
  // Vendor tab: hardware brand (key = brandKey(brand)) → vendor id ("" = the PO's vendor; the brand stays listed).
  // Shown on every hardware row of that brand.
  brandVendors?: Record<string, string>;
  // Last W/D/H formula typed in a panel row's Width / Height (key: group|cabinet no|row no in that cabinet|width or height), e.g. "W-10".
  // Only shown while it still gives the cell's value.
  dimNotes?: Record<string, string>;
  // Shutter / Cabinet Details: extra "Additional External Brand & Colour" picks (labels). For information only: shown in the
  // editor and the PDF, never used for rates, rows or required-field checks.
  additionalExternal?: { shutter?: string[]; cabinet?: string[] };
  // The highlight colour (hex, e.g. #fde68a) picked for each additional external pick, by side and label. Rows whose external colour is
  // that pick are filled with it in the PDFs and the Excel files.
  // Other Panel rows sorted by Description or Thk (set by clicking its column heading); the PDFs list them flat in this order.
  otherPanelSort?: { key: "description" | "depth"; dir: "asc" | "desc" };
  // The highlight colour picked for the Internal / External Brand & Colour on the Shutter / Cabinet Details cards, by side and "internal|label" / "external|label".
  finishColors?: { shutter?: Record<string, string>; cabinet?: Record<string, string> };
  // Proforma Invoice: one entry per status change (date and a note typed in the change popup).
  statusLog?: { status: string; date: string; note: string; amount?: number; advance?: number; balance?: number }[];
  // Proforma Packing page, Transport Details: one entry per transport (name from the Proforma Library list), its LR number and box count.
  transport?: { name: string; lr: string; date?: string; boxes: number }[];
  // Proforma Packing page: per cut-list row, one entry per piece (Qty): ticked as packed or not, with its own note.
  packing?: Record<string, { pieces: { done: boolean; note: string; seq?: number; tr?: number }[] }>;
  additionalColors?: { shutter?: Record<string, string>; cabinet?: Record<string, string> };
  // Hardware tab, per merged hardware item (key = brand|description|article no|category|unit, lower case): Stock Qty typed by hand,
  // and the deliveries received, each with its own vendor (Received Qty = their total).
  hardwareStock?: Record<string, { stock?: number; receipts?: { id: string; vendorId?: string; billNo: string; qty: number; date: string; remark: string }[] }>;
};

export const brandKey = (brand: string) => brand.trim().toLowerCase();

// Who a hardware brand is bought from: the vendor picked for it in the Vendor tab, else the PO's vendor.
export function brandVendorName(po: PurchaseOrder, vendors: { id: string; name: string }[], brand: string) {
  const id = po.material.brandVendors?.[brandKey(brand)] || po.vendorId;
  return vendors.find((v) => v.id === id)?.name ?? po.vendorName ?? "";
}

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

// The highlight colour for a panel line, if its external colour is one of the additional external picks with a colour chosen.
// Shutter rows look at the Shutter Details picks; Carcass and Other Panel rows look at the Cabinet Details picks.
export function highlightFor(po: PurchaseOrder, l: Pick<PurchaseOrderLine, "group" | "externalColour">): string | undefined {
  if (l.group === "hardware" || !l.externalColour) return undefined;
  const own = l.group === "shutter" ? "shutter" : "cabinet";
  const other = own === "shutter" ? "cabinet" : "shutter";
  // A pick's colour is looked up on the row's own side first, then on the other card (the same colour pick may be made on either).
  for (const side of [own, other] as const) {
    if ((po.material.additionalExternal?.[side] ?? []).includes(l.externalColour)) {
      const c = po.material.additionalColors?.[side]?.[l.externalColour];
      if (c) return c;
    }
  }
  // Then the colour picked for the card's own External Brand & Colour.
  return po.material.finishColors?.[own]?.[`external|${l.externalColour}`];
}
// The colour picked for the card's Internal Brand & Colour, for a row that uses it.
export function highlightInternal(po: PurchaseOrder, l: Pick<PurchaseOrderLine, "group" | "internalColour">): string | undefined {
  if (l.group === "hardware" || !l.internalColour) return undefined;
  return po.material.finishColors?.[l.group === "shutter" ? "shutter" : "cabinet"]?.[`internal|${l.internalColour}`];
}

// Other Panel rows in the saved sort order (Description or Thk), ties kept in their original order.
export function sortOtherPanel<T extends Pick<PurchaseOrderLine, "description" | "depth">>(rows: T[], sort?: PoMaterial["otherPanelSort"]): T[] {
  if (!sort) return rows;
  const d = sort.dir === "desc" ? -1 : 1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const c = sort.key === "depth" ? a.r.depth - b.r.depth : a.r.description.localeCompare(b.r.description, undefined, { sensitivity: "base", numeric: true });
      return c * d || a.i - b.i;
    })
    .map((x) => x.r);
}
