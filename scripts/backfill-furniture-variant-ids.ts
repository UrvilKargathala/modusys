import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { makeUniqueVariantId, normalizeVariantId, suggestVariantId } from "../lib/variant-id";

// One-shot backfill: gives every Furniture Price List row that has no Variant ID
// one generated from its material names (e.g. 18MM-BWP-PLY-WHITE-MATTE-CHARCOAL).
// Rows that already have an ID are never touched. Safe to re-run.
//
// Usage:
//   npm run backfill-furniture-variant-ids           # dry run (prints what would change)
//   npm run backfill-furniture-variant-ids -- --apply

const apply = process.argv.includes("--apply");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

  const [rows, materials] = await Promise.all([
    prisma.furniturePriceItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.materialItem.findMany({ select: { id: true, name: true } }),
  ]);
  const name = new Map(materials.map((m) => [m.id, m.name]));

  const taken = new Set(rows.filter((r) => !r.deleted && r.variantId).map((r) => normalizeVariantId(r.variantId)));
  const todo = rows.filter((r) => !r.variantId);
  console.log(`${rows.length} rows, ${todo.length} without a Variant ID${apply ? "" : " (dry run)"}`);

  for (const r of todo) {
    const base = suggestVariantId([r.thicknessId, r.rawMaterialTypeId, r.internalColourId, r.externalColourId].map((id) => name.get(id) ?? ""));
    const id = makeUniqueVariantId(base, taken);
    taken.add(id);
    console.log(`  ${r.id}  ->  ${id}${r.deleted ? "  (deleted row)" : ""}`);
    if (apply) await prisma.furniturePriceItem.update({ where: { id: r.id }, data: { variantId: id } });
  }
  console.log(apply ? "Done." : "Nothing written. Re-run with --apply.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
