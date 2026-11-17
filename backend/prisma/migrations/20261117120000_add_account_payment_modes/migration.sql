-- Additive only: a new list of payment modes for the Accounts entry form, filled with the 5 modes the app had built in.

-- CreateTable
CREATE TABLE "AccountPaymentMode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountPaymentMode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountPaymentMode_name_key" ON "AccountPaymentMode"("name");

-- The modes entries already use, in the order the form showed them.
INSERT INTO "AccountPaymentMode" ("id", "name", "sortOrder", "updatedAt") VALUES
    ('pmode_cash', 'Cash', 1, CURRENT_TIMESTAMP),
    ('pmode_bank', 'Bank Transfer / NEFT / RTGS', 2, CURRENT_TIMESTAMP),
    ('pmode_upi', 'UPI', 3, CURRENT_TIMESTAMP),
    ('pmode_cheque', 'Cheque', 4, CURRENT_TIMESTAMP),
    ('pmode_card', 'Card', 5, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
