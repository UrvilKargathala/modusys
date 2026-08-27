-- Rename the existing selection-key field to "length" and add a new
-- "width" field alongside it (Length/Width/Height as three distinct
-- selection keys, matching a real drawer opening's dimensions).
ALTER TABLE "PanelCalcSpec" RENAME COLUMN "width" TO "length";
ALTER TABLE "PanelCalcSpec" ADD COLUMN "width" INTEGER NOT NULL DEFAULT 0;

-- Bottom/Back Panel become JSON arrays of {id, label, widthFormula,
-- heightFormula} so a spec can define multiple cut panels per side.
-- Existing single formula pairs migrate in as a one-item array each.
ALTER TABLE "PanelCalcSpec" ADD COLUMN "bottomPanels" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "PanelCalcSpec" ADD COLUMN "backPanels" JSONB NOT NULL DEFAULT '[]';

UPDATE "PanelCalcSpec" SET
  "bottomPanels" = jsonb_build_array(jsonb_build_object(
    'id', md5(random()::text || clock_timestamp()::text),
    'label', 'Bottom Panel',
    'widthFormula', "bottomPanelWidth",
    'heightFormula', "bottomPanelHeight"
  )),
  "backPanels" = jsonb_build_array(jsonb_build_object(
    'id', md5(random()::text || clock_timestamp()::text),
    'label', 'Back Panel',
    'widthFormula', "backPanelWidth",
    'heightFormula', "backPanelHeight"
  ));

ALTER TABLE "PanelCalcSpec" DROP COLUMN "bottomPanelWidth";
ALTER TABLE "PanelCalcSpec" DROP COLUMN "bottomPanelHeight";
ALTER TABLE "PanelCalcSpec" DROP COLUMN "backPanelWidth";
ALTER TABLE "PanelCalcSpec" DROP COLUMN "backPanelHeight";

DROP INDEX IF EXISTS "PanelCalcSpec_brand_product_width_height_key";
CREATE UNIQUE INDEX "PanelCalcSpec_brand_product_length_width_height_key" ON "PanelCalcSpec"("brand", "product", "length", "width", "height");
