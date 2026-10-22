import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { makeDbAdapter } from "../lib/db-adapter";

// One-shot: merges the External Colour list into the Internal Colour list (now the single "Colour" list) for the Purchase Material
// Library and the Proforma Library. External entries already in the Colour list (same brand + code) are reused, the rest are copied
// over; Purchase Furniture Price rows are re-pointed to the surviving entry; the old External entries are soft-deleted (not dropped).
// Safe to re-run (a second run finds no live External entries).
//
// Usage (dry run by default):
//   npx tsx scripts/merge-colour-libraries.ts
//   npx tsx scripts/merge-colour-libraries.ts --apply

const apply = process.argv.includes("--apply");
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: makeDbAdapter(connectionString) });
  console.log(`Merging External into Colour${apply ? " (APPLY)" : " (dry run)"}`);

  for (const lib of ["purchase", "proforma"]) {
    const [internals, externals] = await Promise.all([
      prisma.materialItem.findMany({ where: { category: `${lib}-internal`, deleted: false } }),
      prisma.materialItem.findMany({ where: { category: `${lib}-external`, deleted: false } }),
    ]);
    const key = (m: { name: string; description: string }) => `${norm(m.description)}|${norm(m.name)}`;
    const byKey = new Map(internals.map((m) => [key(m), m.id]));
    const remap = new Map<string, string>();
    let copied = 0;
    for (const e of externals) {
      let target = byKey.get(key(e));
      if (!target) {
        target = `mi-${randomUUID()}`;
        byKey.set(key(e), target);
        copied++;
        console.log(`  ${lib}: copy "${e.description} — ${e.name}" -> ${target}`);
        if (apply) await prisma.materialItem.create({ data: { id: target, category: `${lib}-internal`, name: e.name, description: e.description } });
      }
      remap.set(e.id, target);
    }
    console.log(`${lib}: ${externals.length} External entries, ${copied} copied, ${externals.length - copied} already in Colour`);

    if (lib === "purchase") {
      const rows = await prisma.purchaseFurniturePriceItem.findMany({ where: { externalColourId: { in: [...remap.keys()] } } });
      console.log(`  ${rows.length} Purchase Furniture Price rows re-pointed`);
      if (apply) for (const r of rows) await prisma.purchaseFurniturePriceItem.update({ where: { id: r.id }, data: { externalColourId: remap.get(r.externalColourId)! } });
    }
    if (apply && externals.length) await prisma.materialItem.updateMany({ where: { id: { in: externals.map((e) => e.id) } }, data: { deleted: true } });
  }
  console.log(apply ? "Done." : "Nothing written. Re-run with --apply.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
