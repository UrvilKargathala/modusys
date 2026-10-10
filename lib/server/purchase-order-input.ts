import "server-only";

const str = (v: unknown) => String(v ?? "");
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const GROUPS = ["carcass", "shutter", "other-panel", "hardware"];

// Normalises client-sent PO lines; the server never trusts shape or numbers.
export function cleanLines(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.map((l: Record<string, unknown>, i) => ({
    group: GROUPS.includes(str(l.group)) ? str(l.group) : "carcass",
    srNo: Math.round(num(l.srNo)),
    position: i,
    description: str(l.description),
    designType: str(l.designType),
    width: num(l.width),
    depth: num(l.depth),
    height: num(l.height),
    qty: num(l.qty, 1),
    sqft: num(l.sqft),
    internalColour: str(l.internalColour),
    externalColour: str(l.externalColour),
    material: str(l.material),
    articleNo: str(l.articleNo),
    brand: str(l.brand),
    category: str(l.category),
    unit: str(l.unit),
    rate: num(l.rate),
    discountPct: num(l.discountPct),
    remarks: str(l.remarks),
    vendorId: str(l.vendorId),
  }));
}

export function cleanMaterial(m: unknown) {
  const o = (m ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  const cabinets: Record<string, { label: string; unitName: string; space: string; width: number; depth: number; height: number; qty: number; cabinetTypeId: string; unitQty: number; designType: string; remark: string; design: string; cabinetName: string; vendorId: string }> = {};
  for (const [k, v] of Object.entries((o.cabinets ?? {}) as Record<string, Record<string, unknown>>)) {
    cabinets[k] = {
      label: str(v?.label),
      unitName: str(v?.unitName),
      space: str(v?.space),
      width: num(v?.width),
      depth: num(v?.depth),
      height: num(v?.height),
      qty: num(v?.qty, 1),
      cabinetTypeId: str(v?.cabinetTypeId),
      unitQty: num(v?.unitQty, 1),
      designType: str(v?.designType),
      remark: str(v?.remark),
      design: str(v?.design),
      cabinetName: str(v?.cabinetName),
      vendorId: str(v?.vendorId),
    };
  }
  return {
    shutterRawMaterial: str(o.shutterRawMaterial),
    otherRawMaterial: str(o.otherRawMaterial),
    cabinetRawMaterial: str(o.cabinetRawMaterial),
    cabinetOtherRawMaterial: str(o.cabinetOtherRawMaterial),
    internalColours: list(o.internalColours),
    externalColours: list(o.externalColours),
    cabinets,
    productTypeId: str(o.productTypeId) || undefined,
    brandVendors: Object.fromEntries(
      Object.entries((o.brandVendors ?? {}) as Record<string, unknown>)
        .filter(([k, v]) => k && typeof v === "string")
        .map(([k, v]) => [str(k), str(v)])
    ),
    // Shutter / Cabinet Details colour picks (only the four known keys, as text).
    finishes: Object.fromEntries(
      (["shutterInternalColour", "shutterExternalColour", "cabinetInternalColour", "cabinetExternalColour"] as const)
        .filter((k) => typeof (o.finishes as Record<string, unknown> | undefined)?.[k] === "string")
        .map((k) => [k, str((o.finishes as Record<string, unknown>)[k])])
    ),
  };
}
