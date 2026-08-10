import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// One-shot User ↔ Employee auto-linker. Matches by:
//   1. Exact email (case-insensitive) — strongest signal.
//   2. Exact name (case-insensitive) — fallback when emails differ.
// Skips users that are already linked. Skips employees that are already
// claimed by another user (@unique on User.employeeId).
//
// Idempotent — safe to re-run. Dry-run by default; --apply writes.
//   npm run link-users-employees               (dry run)
//   npm run link-users-employees -- --apply    (write)

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) {
    console.error("Refusing: DATABASE_URL is not set.");
    process.exit(1);
  }
  const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

  try {
    const [users, employees] = await Promise.all([
      p.user.findMany({ select: { id: true, name: true, email: true, employeeId: true } }),
      p.employee.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true } }),
    ]);

    const claimed = new Set(users.map((u) => u.employeeId).filter(Boolean) as string[]);
    let byEmail = 0, byName = 0, skipped = 0;
    const changes: string[] = [];

    for (const u of users) {
      if (u.employeeId) { skipped++; continue; }

      let match = employees.find(
        (e) => !claimed.has(e.id) && e.email && norm(e.email) === norm(u.email)
      );
      let reason = "email";
      if (!match) {
        match = employees.find(
          (e) => !claimed.has(e.id) && norm(e.name) === norm(u.name)
        );
        reason = "name";
      }
      if (!match) continue;

      if (reason === "email") byEmail++; else byName++;
      claimed.add(match.id);
      changes.push(`  ${u.name} <${u.email}>  →  ${match.name}  (${reason})`);
      if (apply) {
        await p.user.update({ where: { id: u.id }, data: { employeeId: match.id } });
      }
    }

    console.log(`Users read: ${users.length}, already linked: ${skipped}`);
    console.log(`${apply ? "Linked" : "Would link"}: ${byEmail + byName}  (email:${byEmail}, name:${byName})`);
    changes.forEach((c) => console.log(c));
    if (!apply) console.log("\nDry run. Re-run with --apply to write.");
  } finally {
    await p.$disconnect();
  }
}

void main();
