DROP INDEX IF EXISTS "PanelCalcSpec_brand_product_width_length_height_key";
ALTER TABLE "PanelCalcSpec" DROP COLUMN "width";
CREATE UNIQUE INDEX "PanelCalcSpec_brand_product_length_height_key" ON "PanelCalcSpec"("brand", "product", "length", "height");
