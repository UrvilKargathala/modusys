// One cut panel — a formula (e.g. "W-10", "H-24") evaluated against the
// parent spec's Length(W)/Height(H) via evaluateFormula()
// (lib/quote-pricing.ts). A spec can list several under each side (e.g.
// two different Bottom Panel cuts).
export type PanelFormula = {
  id: string;
  label: string;
  description: string;
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
  bottomPanels: PanelFormula[];
  backPanels: PanelFormula[];
  createdAt: string;
};

// No seed data — these are real hardware catalog dimensions (Bottom/Back
// Panel formulas per brand/product/length/height) that only the admin
// can supply correctly; shipping guessed numbers here would produce wrong
// cutting dimensions.
export const mockPanelCalcSpecs: PanelCalcSpec[] = [];
