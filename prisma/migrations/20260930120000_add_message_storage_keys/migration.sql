-- Additive only: Garage/S3 keys for chat attachments. Old URL columns untouched.
ALTER TABLE "Message" ADD COLUMN "audioKey" TEXT,
ADD COLUMN "imageKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "pdfKey" TEXT;
