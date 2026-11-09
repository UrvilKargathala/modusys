-- CreateTable
CREATE TABLE "AccountHead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountEntry" (
    "id" TEXT NOT NULL,
    "entryNo" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "headId" TEXT,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT '',
    "partyType" TEXT NOT NULL DEFAULT '',
    "partyId" TEXT,
    "partyName" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT NOT NULL DEFAULT '',
    "attachmentKey" TEXT,
    "attachmentName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountHead_type_name_key" ON "AccountHead"("type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAccount_name_key" ON "PaymentAccount"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccountEntry_entryNo_key" ON "AccountEntry"("entryNo");

-- CreateIndex
CREATE INDEX "AccountEntry_date_idx" ON "AccountEntry"("date");

-- CreateIndex
CREATE INDEX "AccountEntry_accountId_date_idx" ON "AccountEntry"("accountId", "date");

-- CreateIndex
CREATE INDEX "AccountEntry_toAccountId_date_idx" ON "AccountEntry"("toAccountId", "date");

-- CreateIndex
CREATE INDEX "AccountEntry_headId_date_idx" ON "AccountEntry"("headId", "date");

-- CreateIndex
CREATE INDEX "AccountEntry_partyType_partyId_idx" ON "AccountEntry"("partyType", "partyId");

-- AddForeignKey
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_headId_fkey" FOREIGN KEY ("headId") REFERENCES "AccountHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Checks Prisma cannot express: amounts are always positive; a transfer goes to a different account.
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_transfer_accounts" CHECK ("toAccountId" IS NULL OR "toAccountId" <> "accountId");

-- Starter heads from the Daily Income & Expense guide; rename or deactivate them in Account Heads.
INSERT INTO "AccountHead" ("id", "name", "type", "updatedAt")
SELECT gen_random_uuid()::text, h.name, h.type, CURRENT_TIMESTAMP
FROM (VALUES
  ('Furniture Sales / Sales Receipt', 'income'),
  ('Customer Advance', 'income'),
  ('Other Income', 'income'),
  ('Interest Income', 'income'),
  ('Miscellaneous Income', 'income'),
  ('Office Expenses', 'expense'),
  ('Staff Salary', 'expense'),
  ('Electricity & Utilities', 'expense'),
  ('Travelling Expenses', 'expense'),
  ('Tea & Refreshments', 'expense'),
  ('Stationery & Printing', 'expense'),
  ('Transport & Delivery', 'expense'),
  ('Factory Expenses', 'expense'),
  ('Repairs & Maintenance', 'expense'),
  ('Rent', 'expense'),
  ('Professional Fees', 'expense'),
  ('Miscellaneous Expenses', 'expense')
) AS h(name, type);
