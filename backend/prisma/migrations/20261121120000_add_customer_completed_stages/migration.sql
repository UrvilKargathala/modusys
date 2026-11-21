-- Additive only: the Pipeline card's "stage done" ticks move from each browser's localStorage into the database,
-- so the website and the phone share them. Existing customers start with no ticks.

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "completedStages" TEXT[] DEFAULT ARRAY[]::TEXT[];
