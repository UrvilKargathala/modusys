ALTER TABLE "PanelCalcSpec" ADD COLUMN "panels" JSONB NOT NULL DEFAULT '[]';
UPDATE "PanelCalcSpec" SET "panels" = COALESCE("bottomPanels", '[]'::jsonb) || COALESCE("backPanels", '[]'::jsonb);
ALTER TABLE "PanelCalcSpec" DROP COLUMN "bottomPanels";
ALTER TABLE "PanelCalcSpec" DROP COLUMN "backPanels";
