ALTER TABLE "PanelCalcSpec" RENAME COLUMN "length" TO "width";
DROP INDEX IF EXISTS "PanelCalcSpec_brand_product_length_height_key";
CREATE UNIQUE INDEX "PanelCalcSpec_brand_product_width_height_key" ON "PanelCalcSpec"("brand", "product", "width", "height");
