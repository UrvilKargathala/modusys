import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 reads datasource/migrations config from here (not just schema.prisma).
// DATABASE_URL comes from .env via dotenv — never hardcoded.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
