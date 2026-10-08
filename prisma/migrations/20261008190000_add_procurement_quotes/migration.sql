-- CreateTable
CREATE TABLE "ProcurementQuote" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementQuote_quoteId_key" ON "ProcurementQuote"("quoteId");
