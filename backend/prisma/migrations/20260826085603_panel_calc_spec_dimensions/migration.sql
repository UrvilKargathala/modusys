-- Table only holds test data at this point (feature just introduced),
-- so it's simplest to clear it out rather than backfill guessed dimensions.
TRUNCATE TABLE "PanelCalcSpec";

-- DropIndex
DROP INDEX IF EXISTS "PanelCalcSpec_brand_product_tandemLength_height_key";

-- AlterTable
ALTER TABLE "PanelCalcSpec" RENAME COLUMN "tandemLength" TO "width";
ALTER TABLE "PanelCalcSpec" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PanelCalcSpec" ADD COLUMN "bottomPanelWidth" INTEGER NOT NULL;
ALTER TABLE "PanelCalcSpec" ADD COLUMN "bottomPanelHeight" INTEGER NOT NULL;
ALTER TABLE "PanelCalcSpec" ADD COLUMN "backPanelWidth" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PanelCalcSpec_brand_product_width_height_key" ON "PanelCalcSpec"("brand", "product", "width", "height");
