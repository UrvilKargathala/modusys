-- Convert panel dimensions from fixed integers to formula strings (e.g.
-- "W-10"). Existing integer values convert to their literal text form
-- ("489"), which evaluateFormula() still resolves correctly as a constant.
ALTER TABLE "PanelCalcSpec" ALTER COLUMN "bottomPanelWidth" TYPE TEXT USING "bottomPanelWidth"::text;
ALTER TABLE "PanelCalcSpec" ALTER COLUMN "bottomPanelHeight" TYPE TEXT USING "bottomPanelHeight"::text;
ALTER TABLE "PanelCalcSpec" ALTER COLUMN "backPanelWidth" TYPE TEXT USING "backPanelWidth"::text;
ALTER TABLE "PanelCalcSpec" ALTER COLUMN "backPanelHeight" TYPE TEXT USING "backPanelHeight"::text;
