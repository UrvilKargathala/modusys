-- CreateTable
CREATE TABLE "PanelCalcTicket" (
    "id" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "rows" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanelCalcTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PanelCalcTicket_no_key" ON "PanelCalcTicket"("no");
