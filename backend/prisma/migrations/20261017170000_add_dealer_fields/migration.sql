-- Additive: dealer details kept on the Vendor row (empty for vendors).
ALTER TABLE "Vendor" ADD COLUMN "category" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Vendor" ADD COLUMN "area" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Vendor" ADD COLUMN "salesPerson" TEXT NOT NULL DEFAULT '';
