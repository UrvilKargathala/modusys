ALTER TABLE "PanelCalcSpec" ADD COLUMN "length" INTEGER NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS "PanelCalcSpec_brand_product_width_height_key";
CREATE UNIQUE INDEX "PanelCalcSpec_brand_product_width_length_height_key" ON "PanelCalcSpec"("brand", "product", "width", "length", "height");
