-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "designerId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "propertyTypeId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "salesExecutiveId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "siteEngineerId" TEXT NOT NULL DEFAULT '';
