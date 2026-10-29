-- Furniture Price List: a free-text description on each price row. Additive; existing rows get ''.
ALTER TABLE "FurniturePriceItem" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
