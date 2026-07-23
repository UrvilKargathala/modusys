-- CreateTable
CREATE TABLE "MaterialItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FurniturePriceItem" (
    "id" TEXT NOT NULL,
    "thicknessId" TEXT NOT NULL,
    "rawMaterialTypeId" TEXT NOT NULL,
    "internalColourId" TEXT NOT NULL,
    "externalColourId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FurniturePriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HardwarePriceItem" (
    "id" TEXT NOT NULL,
    "articleNo" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "mrp" DOUBLE PRECISION NOT NULL,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HardwarePriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CabinetType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "brandId" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "components" JSONB NOT NULL DEFAULT '[]',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CabinetType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cabinetTypeLinks" JSONB NOT NULL DEFAULT '[]',
    "components" JSONB NOT NULL DEFAULT '[]',
    "externalFinishes" JSONB NOT NULL DEFAULT '[]',
    "otherPanels" JSONB NOT NULL DEFAULT '[]',
    "hardware" JSONB NOT NULL DEFAULT '[]',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplateSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "layout" JSONB NOT NULL,
    "branding" JSONB NOT NULL,
    "banking" JSONB NOT NULL,
    "signature" JSONB NOT NULL,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "terms" JSONB NOT NULL DEFAULT '[]',
    "paymentTerms" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplateSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "date" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT,
    "architectId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "productTypeId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "markupMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "materialDescriptionId" TEXT NOT NULL DEFAULT '',
    "shutterFinishId" TEXT NOT NULL DEFAULT '',
    "handleTypeId" TEXT NOT NULL DEFAULT '',
    "hingesTypeId" TEXT NOT NULL DEFAULT '',
    "clientResponsibilityId" TEXT NOT NULL DEFAULT '',
    "units" JSONB NOT NULL DEFAULT '[]',
    "specialDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installationFreightIncluded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialItem_category_idx" ON "MaterialItem"("category");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
