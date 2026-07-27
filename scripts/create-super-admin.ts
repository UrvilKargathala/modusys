import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

// Same algorithm + cost factor as lib/server/password.ts (used by the real
// sign-in flow) — not imported directly because that file is guarded with
// `import "server-only"`, a Next.js build-time marker that only resolves
// inside Next's bundler, not under a plain `tsx` script run.
const SALT_ROUNDS = 12;
function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Standalone script — run outside the Next.js server, so it builds its own
// Prisma client directly (same pattern as prisma/seed.ts) rather than going
// through lib/server/prisma.ts's request-scoped lazy proxy.
//
// Usage:
//   npm run create-super-admin -- --email you@example.com --password 'Some$trongPass1' --name "Full Name"
// or set env vars instead of flags:
//   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... SUPER_ADMIN_NAME=... npm run create-super-admin
//
// Never pass the password as a bare CLI arg on a shared machine if you can
// avoid it — prefer the env var form so it doesn't land in shell history.

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = (readArg("--email") ?? process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = readArg("--password") ?? process.env.SUPER_ADMIN_PASSWORD ?? "";
  const name = readArg("--name") ?? process.env.SUPER_ADMIN_NAME ?? "";

  if (!email || !password) {
    console.error("Usage: npm run create-super-admin -- --email <email> --password <password> [--name <name>]");
    console.error("(or set SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD / SUPER_ADMIN_NAME instead of flags)");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Refusing: password must be at least 12 characters.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Refusing: DATABASE_URL is not set in the environment.");
    process.exit(1);
  }

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await hashPassword(password);
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      await prisma.user.update({
        where: { email },
        data: {
          name: name || existing.name,
          passwordHash,
          role: "super-admin",
          status: "active",
          mustChangePassword: false,
          passwordUpdatedAt: new Date(),
        },
      });
      console.log(`Success: updated existing user "${email}" to Super Admin with a new password.`);
    } else {
      if (!name) {
        console.error("Refusing: --name (or SUPER_ADMIN_NAME) is required when creating a brand-new user.");
        process.exit(1);
      }
      await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "super-admin",
          status: "active",
          mustChangePassword: false,
          passwordUpdatedAt: new Date(),
        },
      });
      console.log(`Success: created new Super Admin user "${email}".`);
    }
  } catch (err) {
    console.error("Failed to create/update Super Admin user:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
