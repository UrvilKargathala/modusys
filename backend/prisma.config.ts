import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 reads datasource/migrations config from here (not just schema.prisma).
// DATABASE_URL comes from the repo root's .env via dotenv — never hardcoded.
config({ path: path.resolve(__dirname, "..", ".env") });

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "npx tsx backend/prisma/seed.ts",
  },
});
