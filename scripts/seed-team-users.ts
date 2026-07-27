import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";
import { roleKeys, type RoleKey } from "../lib/constants/roles";

// Same algorithm + cost factor as lib/server/password.ts (used by the real
// sign-in flow) — not imported directly because that file is guarded with
// `import "server-only"`, a Next.js build-time marker that only resolves
// inside Next's bundler, not under a plain `tsx` script run (see
// create-super-admin.ts for the same workaround).
const SALT_ROUNDS = 12;
function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Real org roster, seeded with a shared temp password that every account
// must rotate on first sign-in (mustChangePassword: true). Skips
// chirag.patel@modusys.in — already provisioned with its own password.
//
// Usage:
//   TEAM_TEMP_PASSWORD='...' npm run seed-team-users
const TEAM: { email: string; name: string; role: RoleKey }[] = [
  { email: "chiragpatelgm@gmail.com", name: "Chirag Patel", role: "super-admin" },
  { email: "patelhenil34@gmail.com", name: "Henil Patel", role: "super-admin" },
  { email: "vipul.dodiya06@gmail.com", name: "Vipul Dodiya", role: "super-admin" },
  { email: "pritithakur0106@gmail.com", name: "Priti Thakur", role: "admin" },
  { email: "devangees@gmail.com", name: "Devangee Sailor", role: "staff" },
  { email: "brijeshmendpara1234@gmail.com", name: "Brijesh Mendapara", role: "staff" },
  { email: "bhaskarvijay4855@gmail.com", name: "Vijay Bhaskar", role: "staff" },
  { email: "patelmihirkumar7698@gmail.com", name: "Mihir Patel", role: "staff" },
];

async function main() {
  const tempPassword = process.env.TEAM_TEMP_PASSWORD ?? "";
  if (!tempPassword) {
    console.error("Refusing: TEAM_TEMP_PASSWORD is not set in the environment.");
    process.exit(1);
  }
  if (tempPassword.length < 12) {
    console.error("Refusing: TEAM_TEMP_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Refusing: DATABASE_URL is not set in the environment.");
    process.exit(1);
  }
  for (const { role } of TEAM) {
    if (!roleKeys.includes(role)) {
      console.error(`Refusing: unknown role "${role}" — must be one of ${roleKeys.join(", ")}`);
      process.exit(1);
    }
  }

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const passwordHash = await hashPassword(tempPassword);

  const results: { email: string; outcome: "created" | "updated" | "failed" }[] = [];

  try {
    for (const { email, name, role } of TEAM) {
      try {
        const existing = await prisma.user.findUnique({ where: { email } });
        await prisma.user.upsert({
          where: { email },
          update: {
            name,
            role,
            status: "active",
            passwordHash,
            mustChangePassword: true,
          },
          create: {
            email,
            name,
            role,
            status: "active",
            passwordHash,
            mustChangePassword: true,
          },
        });
        results.push({ email, outcome: existing ? "updated" : "created" });
      } catch (err) {
        console.error(`  ✗ ${email}: ${err instanceof Error ? err.message : err}`);
        results.push({ email, outcome: "failed" });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("\nSummary:");
  for (const r of results) {
    console.log(`  ${r.outcome === "failed" ? "✗" : "✓"} ${r.email} — ${r.outcome}`);
  }
  const failed = results.filter((r) => r.outcome === "failed").length;
  if (failed > 0) {
    console.error(`\n${failed} account(s) failed.`);
    process.exit(1);
  }
}

void main();
