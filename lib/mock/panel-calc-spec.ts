// One cut panel — a formula (e.g. "W-10", "H-24") evaluated against the
// parent spec's Width(W)/Height(H) via evaluateFormula()
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
  width: number;
  height: number;
  description: string;
  panels: PanelFormula[];
  createdAt: string;
};

// No seed data — these are real hardware catalog dimensions (Bottom/Back
// Panel formulas per brand/product/width/height) that only the admin
// can supply correctly; shipping guessed numbers here would produce wrong
// cutting dimensions.
export const mockPanelCalcSpecs: PanelCalcSpec[] = [];
