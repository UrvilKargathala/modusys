// One cut panel — a formula (e.g. "W-10", "H-24") evaluated against the
// spec's Length(D)/Height(H) plus a Width(W) provided at calculation time
// (the Panel Calculator's own Width field — not stored on the spec, since
// the same formulas apply at any width) via evaluateFormula()
// (lib/quote-pricing.ts). A spec lists several — label distinguishes them
// (e.g. "Bottom Panel", "Back Panel").
export type PanelFormula = {
  id: string;
  label: string;
  widthFormula: string;
  heightFormula: string;
  thickness: number;
};

export type PanelCalcSpec = {
  id: string;
  brand: string;
  product: string;
  length: number;
  height: number;
  description: string;
  panels: PanelFormula[];
  createdAt: string;
};

// No seed data — these are real hardware catalog dimensions (Bottom/Back
// Panel formulas per brand/product/length/height) that only the admin
// can supply correctly; shipping guessed numbers here would produce wrong
// cutting dimensions.
export const mockPanelCalcSpecs: PanelCalcSpec[] = [];
