-- CreateTable
CREATE TABLE "PanelCalcSpec" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "tandemLength" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "backPanelHeight" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanelCalcSpec_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PanelCalcSpec_brand_product_idx" ON "PanelCalcSpec"("brand", "product");

-- CreateIndex
CREATE UNIQUE INDEX "PanelCalcSpec_brand_product_tandemLength_height_key" ON "PanelCalcSpec"("brand", "product", "tandemLength", "height");
