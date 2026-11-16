-- AlterTable (additive only: one new column with a default; nothing existing changes)
ALTER TABLE "UnitType" ADD COLUMN     "countComponents" BOOLEAN NOT NULL DEFAULT true;
