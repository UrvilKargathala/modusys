import "server-only";
import { PrismaClient } from "@prisma/client";
import { makeDbAdapter } from "@/lib/db-adapter";

// Server-only Prisma singleton (guarded by "server-only" so it can never be
// imported into a client component and leak DATABASE_URL into the bundle).
// Prisma 7 requires a driver adapter for the runtime connection. Which one is chosen
// from the DATABASE_URL host in lib/db-adapter.ts (Neon's serverless driver for Neon,
// plain `pg` for the server's own Postgres).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = makeDbAdapter(connectionString);
  return new PrismaClient({ adapter });
}

// Lazily instantiated so importing this module (e.g. during Next.js build-time
// page-data collection) never touches DATABASE_URL — the client is only built
// on first actual query at runtime, where the env var is available.
function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
