import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error("Usage: npm run import-customers -- <path-to-csv>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const STAGE_MAP: Record<string, string> = {
  upcoming_inquiry: "upcoming-inquiry",
  inquiry_in_process: "inquiry-in-process",
  design: "design",
  quotation: "quotation",
  onsite_measurments: "onsite-measurements",
  onsite_measurements: "onsite-measurements",
  onsite_marking: "onsite-marking",
  production: "production",
  material_requirement_slip: "material-requirement-slip",
  ready_to_dispatch: "ready-to-dispatch",
  installation: "installation",
  services: "services",
  site_completed: "site-completed",
  cancel_order: "cancel-order",
  confirm_quotation: "quotation",
};

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
  const rows = parseCsv(raw);
  console.log(`Parsed ${rows.length} rows from CSV`);

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const deleted = await prisma.customer.deleteMany({});
    console.log(`Deleted ${deleted.count} existing customers`);

    let srNo = 1;
    for (const row of rows) {
      const firstName = row["First Name"] ?? "";
      const lastName = row["Last Name"] ?? "";
      const prefix = row["Prefix"] ?? "";
      const name = [firstName, lastName].filter(Boolean).join(" ") || "Unnamed";
      const csvStage = (row["Stage"] ?? "").trim().toLowerCase();
      const stage = STAGE_MAP[csvStage] ?? "upcoming-inquiry";

      await prisma.customer.create({
        data: {
          name,
          prefix,
          firstName,
          lastName,
          srNo: srNo++,
          customerCode: `${(firstName[0] ?? "").toUpperCase()}${(lastName[0] ?? "").toUpperCase()}`,
          mobile: row["Mobile"] ?? "",
          email: row["Email"] ?? "",
          gst: row["GST No"] ?? "",
          address: row["Address"] ?? "",
          city: row["City"] ?? "",
          state: row["State"] ?? "",
          postcode: row["Postcode"] ?? "",
          birthdayMonth: row["Birthday Month"] ?? "",
          birthdayDay: row["Birthday Day"] ?? "",
          stage,
          assignee: "",
        },
      });
    }
    console.log(`Imported ${rows.length} customers successfully`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
