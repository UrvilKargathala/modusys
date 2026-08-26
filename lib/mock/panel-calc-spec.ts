export type PanelCalcSpec = {
  id: string;
  brand: string;
  product: string;
  width: number;
  height: number;
  description: string;
  bottomPanelWidth: number;
  bottomPanelHeight: number;
  backPanelWidth: number;
  backPanelHeight: number;
  createdAt: string;
};

// No seed data — these are real hardware catalog dimensions (Bottom Panel
// and Back Panel W×H per brand/product/width/height) that only the admin
// can supply correctly; shipping guessed numbers here would produce wrong
// cutting dimensions.
export const mockPanelCalcSpecs: PanelCalcSpec[] = [];
