import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error("Usage: npm run import-architects -- <path-to-csv>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

async function main() {
  const raw = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(raw).filter((r) => r["First Name"] && r["First Name"] !== "N.A");
  console.log(`Parsed ${rows.length} usable rows from CSV`);

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const deleted = await prisma.architect.deleteMany({});
    console.log(`Deleted ${deleted.count} existing architects`);

    for (const row of rows) {
      await prisma.architect.create({
        data: {
          prefix: row["Prefix"] ?? "",
          firstName: row["First Name"] ?? "",
          lastName: row["Last Name"] === "-" ? "" : (row["Last Name"] ?? ""),
          mobile: row["Mobile"] ?? "",
          company: row["Firm Name"] ?? "",
          address: row["Address"] ?? "",
          city: row["City"] ?? "",
          state: row["State"] ?? "",
          postcode: row["Postcode"] ?? "",
          birthdayMonth: row["Birthday Month"] ?? "",
          birthdayDay: row["Birthday Day"] ?? "",
        },
      });
    }
    console.log(`Imported ${rows.length} architects successfully`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
