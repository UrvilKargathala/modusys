-- CreateTable
CREATE TABLE "PurchaseFurniturePriceItem" (
    "id" TEXT NOT NULL,
    "thicknessId" TEXT NOT NULL,
    "rawMaterialTypeId" TEXT NOT NULL,
    "internalColourId" TEXT NOT NULL,
    "externalColourId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "variantId" TEXT NOT NULL DEFAULT '',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseFurniturePriceItem_pkey" PRIMARY KEY ("id")
);

