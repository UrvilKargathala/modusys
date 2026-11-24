-- Additive only: one new nullable column on "User". Nothing existing changes.
ALTER TABLE "User" ADD COLUMN "passwordEncrypted" TEXT;
