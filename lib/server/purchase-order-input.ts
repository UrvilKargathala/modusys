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
  const cabinets: Record<string, { label: string; unitName: string; space: string; width: number; depth: number; height: number; qty: number; cabinetTypeId: string; unitQty: number; designType: string; remark: string; design: string; cabinetName: string; vendorId: string; internalColour: string; externalColour: string; material: string; componentsVisible?: boolean }> = {};
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
      internalColour: str(v?.internalColour),
      externalColour: str(v?.externalColour),
      material: str(v?.material),
      ...(typeof v?.componentsVisible === "boolean" ? { componentsVisible: v.componentsVisible } : {}),
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
    direct: o.direct === true ? true : undefined,
    proforma: o.proforma === true ? true : undefined,
    approxDeliveryDate: str(o.approxDeliveryDate) || undefined,
    highlight: o.highlight === true ? true : undefined,
    orderType: str(o.orderType) || undefined,
    vendorPiNo: str(o.vendorPiNo) || undefined,
    vendorPiDate: str(o.vendorPiDate) || undefined,
    vendorPiAmount: o.vendorPiAmount === undefined || o.vendorPiAmount === null || o.vendorPiAmount === "" ? undefined : num(o.vendorPiAmount),
    brandVendors: Object.fromEntries(
      Object.entries((o.brandVendors ?? {}) as Record<string, unknown>)
        .filter(([k, v]) => k && typeof v === "string")
        .map(([k, v]) => [str(k), str(v)])
    ),
    additionalExternal: {
      shutter: list((o.additionalExternal as Record<string, unknown> | undefined)?.shutter),
      cabinet: list((o.additionalExternal as Record<string, unknown> | undefined)?.cabinet),
    },
    otherPanelSort: (() => {
      const v = o.otherPanelSort as { key?: unknown; dir?: unknown } | undefined;
      return v && (v.key === "description" || v.key === "depth") && (v.dir === "asc" || v.dir === "desc") ? { key: v.key, dir: v.dir } : undefined;
    })(),
    finishColors: (() => {
      const raw = (o.finishColors ?? {}) as Record<string, unknown>;
      const side = (v: unknown) =>
        Object.fromEntries(
          Object.entries((v ?? {}) as Record<string, unknown>)
            .filter(([k, c]) => k && typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c))
            .map(([k, c]) => [str(k), String(c)])
        );
      return { shutter: side(raw.shutter), cabinet: side(raw.cabinet) };
    })(),
    statusLog: (Array.isArray(o.statusLog) ? (o.statusLog as Record<string, unknown>[]) : []).slice(-100).map((e) => ({
      status: str(e?.status).slice(0, 60),
      date: str(e?.date).slice(0, 10),
      note: str(e?.note).slice(0, 500),
      amount: num(e?.amount),
      advance: num(e?.advance),
      balance: num(e?.balance),
    })),
    transport: (Array.isArray(o.transport) ? (o.transport as Record<string, unknown>[]) : []).slice(0, 50).map((t) => ({
      name: str(t?.name).slice(0, 120),
      lr: str(t?.lr).slice(0, 80),
      date: str(t?.date).slice(0, 10),
      boxes: Math.max(0, Math.min(99999, Math.round(num(t?.boxes)))),
    })),
    packing: Object.fromEntries(
      Object.entries((o.packing ?? {}) as Record<string, Record<string, unknown>>)
        .filter(([k]) => k)
        .map(([k, v]) => [
          str(k).slice(0, 200),
          {
            pieces: (Array.isArray(v?.pieces) ? (v.pieces as Record<string, unknown>[]) : [])
              .slice(0, 500)
              .map((x) => ({ done: x?.done === true, note: str(x?.note).slice(0, 300), ...(x?.done === true && num(x?.seq) > 0 ? { seq: Math.min(99999, Math.round(num(x?.seq))), tr: Math.max(0, Math.min(99, Math.round(num(x?.tr)))) } : {}) })),
          },
        ] as const)
    ),
    finishEntries: !Array.isArray(o.finishEntries) ? undefined : (o.finishEntries as Record<string, unknown>[]).slice(0, 100).map((e, i) => ({
      id: str(e?.id).slice(0, 40) || `fe-${i}`,
      where: str(e?.where).slice(0, 20),
      rawMaterial: str(e?.rawMaterial).slice(0, 120),
      internal: str(e?.internal).slice(0, 200),
      external: str(e?.external).slice(0, 200),
    })),
    production: Object.fromEntries(
      Object.entries((o.production ?? {}) as Record<string, Record<string, unknown>>)
        .filter(([k]) => k)
        .map(([k, v]) => [
          str(k).slice(0, 200),
          { pieces: (Array.isArray(v?.pieces) ? (v.pieces as Record<string, unknown>[]) : []).slice(0, 500).map((x) => ({ done: x?.done === true, note: str(x?.note).slice(0, 300) })) },
        ] as const)
    ),
    additionalColors: (() => {
      const raw = (o.additionalColors ?? {}) as Record<string, unknown>;
      const side = (v: unknown) =>
        Object.fromEntries(
          Object.entries((v ?? {}) as Record<string, unknown>)
            .filter(([k, c]) => k && typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c))
            .map(([k, c]) => [str(k), String(c)])
        );
      return { shutter: side(raw.shutter), cabinet: side(raw.cabinet) };
    })(),
    hardwareStock: Object.fromEntries(
      Object.entries((o.hardwareStock ?? {}) as Record<string, Record<string, unknown>>)
        .filter(([k]) => k)
        .map(([k, v]) => {
          const receipts = (Array.isArray(v?.receipts) ? (v.receipts as Record<string, unknown>[]) : []).map((r) => ({
            id: str(r?.id) || `rc-${Math.random().toString(36).slice(2, 8)}`,
            ...(str(r?.vendorId) ? { vendorId: str(r?.vendorId) } : {}),
            billNo: str(r?.billNo).slice(0, 80),
            qty: num(r?.qty),
            date: str(r?.date).slice(0, 10),
            remark: str(r?.remark).slice(0, 300),
          }));
          return [str(k), { ...(typeof v?.stock === "number" && Number.isFinite(v.stock) ? { stock: v.stock } : {}), ...(receipts.length ? { receipts } : {}) }] as const;
        })
        .filter(([, v]) => Object.keys(v).length > 0)
    ),
    dimNotes: Object.fromEntries(
      Object.entries((o.dimNotes ?? {}) as Record<string, unknown>)
        .filter(([k, v]) => k && typeof v === "string" && v)
        .map(([k, v]) => [str(k), str(v).slice(0, 40)])
    ),
    // Shutter / Cabinet Details colour picks (only the four known keys, as text).
    finishes: Object.fromEntries(
      (["shutterInternalColour", "shutterExternalColour", "cabinetInternalColour", "cabinetExternalColour"] as const)
        .filter((k) => typeof (o.finishes as Record<string, unknown> | undefined)?.[k] === "string")
        .map((k) => [k, str((o.finishes as Record<string, unknown>)[k])])
    ),
  };
}
