-- AlterTable (additive only: new columns with defaults; nothing existing changes)
ALTER TABLE "Vendor" ADD COLUMN     "code" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emails" JSONB NOT NULL DEFAULT '[]';
