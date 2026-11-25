-- Additive only: one receipt table for THE FURN website contact form.
-- No existing table is touched. On live this runs as postgres, so the script
-- that applies it must end with:
-- ALTER TABLE "WebsiteInquiry" OWNER TO modusys_app;

CREATE TABLE "WebsiteInquiry" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteInquiry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteInquiry_externalId_key" ON "WebsiteInquiry"("externalId");
CREATE INDEX "WebsiteInquiry_phoneNormalized_idx" ON "WebsiteInquiry"("phoneNormalized");
CREATE INDEX "WebsiteInquiry_customerId_idx" ON "WebsiteInquiry"("customerId");
