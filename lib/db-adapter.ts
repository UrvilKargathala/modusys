import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

// The one place that decides how Prisma talks to the database.
//  - Neon (production today) needs Neon's serverless driver.
//  - Anything else (the server's own Postgres, e.g. staging) is plain Postgres via `pg`.
// When production leaves Neon: delete the Neon branch + import below, then
// `npm rm @prisma/adapter-neon @neondatabase/serverless`.
// No "server-only" import on purpose — the scripts under scripts/ use this too.
export function makeDbAdapter(connectionString: string | undefined) {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const isNeon = new URL(connectionString).hostname.endsWith(".neon.tech");
  return isNeon ? new PrismaNeon({ connectionString }) : new PrismaPg({ connectionString });
}
