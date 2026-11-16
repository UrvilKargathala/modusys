// A log of Panel Calculator results — one entry per Calculate click,
// snapshotting the resolved panel dimensions so the log stays accurate even
// if the underlying PanelCalcSpec's formulas change later.
export type PanelCalcHistoryPanel = {
  id: string;
  label: string;
  width: number;
  height: number;
  thickness: number;
};

export type PanelCalcHistoryEntry = {
  id: string;
  brand: string;
  product: string;
  width: number;
  length: number;
  height: number;
  panels: PanelCalcHistoryPanel[];
  createdAt: string;
};

export const mockPanelCalcHistory: PanelCalcHistoryEntry[] = [];
