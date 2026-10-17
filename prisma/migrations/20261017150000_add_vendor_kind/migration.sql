-- Additive: a Vendor row is either a "vendor" (default, every existing row) or a "dealer" (Proforma Invoices).
ALTER TABLE "Vendor" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'vendor';
