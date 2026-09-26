// Variant ID rules for Furniture Price List rows: letters, numbers and dashes
// only, stored uppercase, required and unique among live rows.
export const VARIANT_ID_MAX = 40;

export function normalizeVariantId(v: string): string {
  return v.trim().toUpperCase();
}

// Same filter the input applies while typing, so invalid characters can't be entered.
export function sanitizeVariantIdInput(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, VARIANT_ID_MAX);
}

export function variantIdFormatError(v: string): string | null {
  const s = v.trim();
  if (!s) return "Variant ID is required";
  if (s.length > VARIANT_ID_MAX) return `Max ${VARIANT_ID_MAX} characters`;
  if (!/^[A-Za-z0-9-]+$/.test(s)) return "Use only letters, numbers and dashes";
  return null;
}

const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Long multi-word names shrink to initials ("Suede Finish Laminate" -> "SFL") so the ID stays readable.
const abbreviate = (p: string) => {
  if (p.length <= 10) return p;
  const words = p.split("-");
  return words.length > 1 ? words.map((w) => w[0]).join("") : p.slice(0, 10);
};

// e.g. ["18mm", "BWP Ply", "White", "Matte Charcoal"] -> "18MM-BWP-PLY-WHITE-MATTE-CHARCOAL"
// (falls back to abbreviated parts when the full name would exceed the max length).
export function suggestVariantId(names: string[]): string {
  const parts = names.map(slug).filter(Boolean);
  let id = parts.join("-");
  if (id.length > VARIANT_ID_MAX) id = parts.map(abbreviate).join("-").slice(0, VARIANT_ID_MAX).replace(/-+$/, "");
  return id || "VARIANT";
}

// `taken` must hold uppercase IDs. Appends -2, -3… until free.
export function makeUniqueVariantId(base: string, taken: ReadonlySet<string>): string {
  const b = normalizeVariantId(base) || "VARIANT";
  if (!taken.has(b)) return b;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const id = b.slice(0, VARIANT_ID_MAX - suffix.length).replace(/-+$/, "") + suffix;
    if (!taken.has(id)) return id;
  }
}
