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
  if (isNeon) return new PrismaNeon({ connectionString });
  // keepAlive: idle connections survive the SSH tunnel / NAT. connectionTimeoutMillis: a dead tunnel errors after 15s instead of
  // loading forever. idleTimeoutMillis: close idle connections before the tunnel drops them ("Connection terminated unexpectedly").
  // max: pg's default of 10 was always full in the 300-user load test (14/11/2026) and made bursts wait up to 8 s.
  // Postgres allows 100; this app process is the only big user of it.
  return new PrismaPg({ connectionString, max: 25, keepAlive: true, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 10_000 });
}
