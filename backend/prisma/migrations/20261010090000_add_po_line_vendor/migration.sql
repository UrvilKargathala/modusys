-- AlterTable (additive only: one new column with a default; nothing existing changes)
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "vendorId" TEXT NOT NULL DEFAULT '';
