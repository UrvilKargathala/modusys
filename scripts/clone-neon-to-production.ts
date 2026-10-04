import { execFile } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, writeFile, readFile, appendFile, stat } from "fs/promises";

const pexec = promisify(execFile);

// Full Neon → office-Postgres snapshot clone (migration doc §9, §14 handoff).
// Creates role + `modusys-production` database, restores an exact pg_dump snapshot,
// verifies table-by-table, and records the snapshot timestamp the delta script
// (scripts/sync-neon-delta.ts) later uses as its cutoff.
//
// Reads config from the process environment ONLY (never .env):
//   NEON_URL  ADMIN_URL (superuser, used ONLY in phase 2, never logged)
//   [TARGET_DB=modusys-production] [APP_ROLE=modusys_app] [DUMP_DIR=.migration/dumps] [JOBS=4]
//
// Usage:
//   NEON_URL=... ADMIN_URL=... npx tsx scripts/clone-neon-to-production.ts --db-host neon.tech   # dry-run
//   ... --apply                         # execute end-to-end
//   ... --apply --use-dump <file>        # skip re-dump, restore from a verified dump file
//   ... --preflight-only | --dump-only   # subsets (dump-only still writes state + SHA)
//
// Exit codes: 0 clean · 1 blocked/failed · 2 completed with items needing review.
// Power-cut contract (drop-and-restart): a state file records the last completed phase.
// Any start finding an incomplete state drops + recreates the target DB and re-runs from the
// kept (SHA-verified) dump file. Mid-dump cuts discard the partial file and re-dump.

const LOCAL_DIR = ".migration";
const DUMP_SUBDIR = "dumps";
const STATE_FILE = `${LOCAL_DIR}/clone-state.json`;

type Phase = "none" | "preflight" | "dumped" | "created" | "restored" | "verified" | "complete";
type State = {
  phase: Phase;
  snapshotAt?: string;
  dumpPath?: string;
  dumpSha256?: string;
  dumpBytes?: number;
  targetDb?: string;
  sourceHost?: string;
  counts?: Record<string, { source: number; target: number }>;
  updatedAt: string;
};

type Failure = { phase: string; code: string; message: string; reason: string };

// Physical table names for the verify count pass (CustomPipelineStage keeps its capital).
const TABLES = [
  "Customer", "MediaAttachment", "Message", "MessageReadReceipt", "MessageReaction",
  "Architect", "ArchitectPartner", "User", "MaterialItem", "PanelCalcSpec", "PanelCalcHistory",
  "FurniturePriceItem", "HardwarePriceItem", "CabinetType", "UnitType", "QuoteTemplateSettings",
  "Quote", "Task", "Notification", "SecurityAuditLog", "AuditLog", "Employee", "AttendanceRecord",
  "LeaveRequest", "UnifiSyncLog", "CustomPipelineStage", "DoorAccessLog", "PhotoAttendanceRecord",
];

const argv = process.argv.slice(2);
// Callers pass the full flag ("--apply"); the helpers used to prepend "--" again, so no flag ever matched.
const flag = (n: string) => argv.includes(n);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

function redact(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return "<unparseable-url>";
  }
}

// Same server/credentials, different database — for pointing an admin URL at the new DB.
function withDb(url: string, db: string): string {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

function classify(tool: string, e: unknown): Failure {
  const err = e as { message?: string; stderr?: string; code?: number | string; stdout?: string };
  // Never let a connection string (with its password) reach the console or the log.
  const out = String(err?.stderr ?? err?.message ?? e ?? "").replace(/postgres(?:ql)?:\/\/[^@\s"']*@/gi, "postgresql://<redacted>@");
  const first = out.split("\n").filter(Boolean).slice(0, 4).join(" | ");
  if (/could not connect|connection refused|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|getaddrinfo/i.test(out)) {
    return { phase: tool, code: "CONNECT", message: first, reason: "database host unreachable — VPN/tailnet down, wrong host, or firewall. Nothing was written; fix connectivity and re-run." };
  }
  if (/password authentication failed|role .* does not exist|permission denied|must be (owner|superuser)|PAM/i.test(out)) {
    return { phase: tool, code: "AUTH", message: first, reason: "credentials or privilege wrong — ADMIN_URL must be superuser (phase 2 only); NEON_URL needs read. Fix URLs and re-run." };
  }
  if (/No space left|ENOSPC|disk full|could not extend/i.test(out)) {
    return { phase: tool, code: "DISK-FULL", message: first, reason: "target disk full — free ≥3× dump size and re-run (state file resumes cleanly)." };
  }
  if (/unsupported version|version mismatch|aborted because of version/i.test(out)) {
    return { phase: tool, code: "VERSION", message: first, reason: "pg_dump/pg_restore major-version skew vs a server — upgrade the older side's client tools and re-run." };
  }
  if (/already exists/i.test(out)) {
    return { phase: tool, code: "EXISTS", message: first, reason: "object already present — stale state from an interrupted run; the script drops + recreates automatically, re-run." };
  }
  if (/does not exist/i.test(out)) {
    return { phase: tool, code: "MISSING", message: first, reason: "referenced object absent — wrong database/role name or an out-of-order phase; check names and state file." };
  }
  return {
    phase: tool, code: "UNKNOWN",
    message: first || "(empty stderr)",
    reason: "unrecognised tool output — full stderr is in the log; do not retry blindly, investigate first.",
  };
}

async function run(tool: string, cmd: string, args: string[], extraEnv?: Record<string, string>): Promise<string> {
  try {
    const { stdout } = await pexec(cmd, args, { env: { ...process.env, ...extraEnv }, maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (e) {
    (e as { toolPhase?: string }).toolPhase = tool;
    throw e;
  }
}

async function psql(url: string, sql: string, db?: string): Promise<string> {
  // Pick the database inside the URL. Passing both a URL and `-d` makes psql read the URL as a
  // USER name and fall back to the local socket (and echo the whole URL, password included, in the error).
  const args = [db ? withDb(url, db) : url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql];
  return run("psql", "psql", args);
}

async function loadState(): Promise<State> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8")) as State;
  } catch {
    return { phase: "none", updatedAt: new Date().toISOString() };
  }
}

async function saveState(s: State, logPath: string) {
  s.updatedAt = new Date().toISOString();
  await writeFile(STATE_FILE, JSON.stringify(s, null, 2));
  await appendFile(logPath, JSON.stringify({ ts: s.updatedAt, state: s.phase, snapshotAt: s.snapshotAt }) + "\n");
}

function fail(f: Failure, logPath: string): never {
  const line = `\nFAILED [${f.phase}] code=${f.code}\n  error="${f.message}"\n  reason: ${f.reason}\n  log: ${logPath}\n`;
  console.error(line);
  appendFile(logPath, JSON.stringify({ ts: new Date().toISOString(), ...f }) + "\n").catch(() => undefined);
  process.exit(1);
}

async function main() {
  const apply = flag("--apply");
  const preflightOnly = flag("--preflight-only");
  const dumpOnly = flag("--dump-only");
  const useDump = opt("--use-dump");
  const jobs = opt("--jobs") ?? "4";
  const neonUrl = process.env.NEON_URL;
  const adminUrl = process.env.ADMIN_URL;
  const targetDb = process.env.TARGET_DB ?? "modusys-production";
  const appRole = process.env.APP_ROLE ?? "modusys_app";
  const expectHost = opt("--db-host");
  if (!neonUrl) throw new Error("NEON_URL is required");
  if (!adminUrl && apply) throw new Error("ADMIN_URL (superuser) is required for --apply");
  if (!expectHost) throw new Error("--db-host <neon host substring> is required (never runs blind)");

  const neonHost = new URL(neonUrl).hostname;
  if (!neonHost.includes(expectHost)) throw new Error(`NEON host "${neonHost}" does not contain "${expectHost}" — refusing.`);
  const adminHost = adminUrl ? new URL(adminUrl).hostname : "(none in dry-run)";

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir(`${LOCAL_DIR}/${DUMP_SUBDIR}`, { recursive: true });
  const logPath = `${LOCAL_DIR}/clone-log-${runId}.ndjson`;
  const log = (e: Record<string, unknown>) => appendFile(logPath, JSON.stringify({ ts: new Date().toISOString(), ...e }) + "\n");

  console.log(`Source:  ${redact(neonUrl)}\nAdmin:   ${adminHost} (used in phase 2 only, never logged)\nTarget:  ${targetDb} (role ${appRole})\nMode:    ${apply ? "APPLY" : "DRY-RUN"}`);
  let state = await loadState();

  // ---- Phase 0: preflight. Refuse to go on if anything is off.
  console.log("\n[0/5] preflight…");
  for (const t of ["pg_dump", "pg_restore", "psql"]) {
    try {
      await run("preflight", t, ["--version"]);
    } catch (e) {
      fail({ ...classify("preflight", e), message: `${t} not found — install postgresql-client on the server first` }, logPath);
    }
  }
  try {
    await run("preflight", "psql", [neonUrl, "-tA", "-c", "SELECT version();"]);
    if (apply && adminUrl) await run("preflight", "psql", [adminUrl, "-tA", "-c", "SELECT 1;"]);
  } catch (e) {
    fail(classify("preflight", e), logPath);
  }
  // Disk headroom: estimate from source size (pg_total_relation_size over our tables).
  try {
    const est = await run("preflight", "psql", [neonUrl, "-tA", "-c",
      `SELECT COALESCE(SUM(pg_total_relation_size(format('%I.%I', schemaname, tablename))),0) FROM pg_tables WHERE schemaname='public';`]);
    console.log(`  source data ≈ ${(Number(est.trim()) / 1e6).toFixed(1)} MB (need ≥3× free on target disk)`);
  } catch (e) {
    fail(classify("preflight", e), logPath);
  }
  // Power-cut recovery point: incomplete state + existing target DB → drop + recreate later.
  // Detect here so dry-run reports it honestly.
  let targetExists = false;
  if (apply && adminUrl) {
    try {
      const r = await psql(adminUrl, `SELECT 1 FROM pg_database WHERE datname='${targetDb.replace(/'/g, "''")}';`);
      targetExists = r.trim() === "1";
    } catch (e) {
      fail(classify("preflight", e), logPath);
    }
  }
  console.log(`  preflight OK. state=${state.phase}${state.phase !== "none" && state.phase !== "complete" ? " (INCOMPLETE — will drop + recreate target)" : ""} target-exists=${targetExists}`);
  state.phase = "preflight";
  await saveState(state, logPath);
  await log({ phase: "preflight-ok", neonHost, adminHost });
  if (preflightOnly || !apply) {
    console.log(`\nDry run — nothing written. Re-run with --apply to execute. State: ${STATE_FILE}`);
    return;
  }

  // ---- Phase 1: dump (consistent snapshot; live Neon writes cannot half-state it).
  console.log("\n[1/5] pg_dump…");
  const dumpPath = useDump ?? `${LOCAL_DIR}/${DUMP_SUBDIR}/neon-${runId}.dump`;
  const snapshotAt = new Date().toISOString();
  if (!useDump) {
    try {
      await run("pg_dump", "pg_dump", ["-Fc", "-f", dumpPath, neonUrl]);
    } catch (e) {
      fail({ ...classify("pg_dump", e), message: `${classify("pg_dump", e).message} — partial dump discarded, re-run re-dumps` }, logPath);
    }
  }
  let st;
  try {
    st = await stat(dumpPath);
    if (st.size === 0) throw new Error("dump file is empty");
  } catch (e) {
    fail({ phase: "pg_dump", code: "DUMP-FILE", message: String((e as Error)?.message ?? e), reason: "dump file missing/empty — re-run re-dumps from scratch." }, logPath);
  }
  const sha = await new Promise<string>((resolve, reject) => {
    const h = createHash("sha256");
    const s = createReadStream(dumpPath);
    s.on("data", (d: Buffer | string) => { h.update(d); });
    s.on("end", () => resolve(h.digest("hex")));
    s.on("error", reject);
  });
  state = { phase: "dumped", snapshotAt, dumpPath, dumpSha256: sha, dumpBytes: st.size, targetDb, sourceHost: neonHost, updatedAt: new Date().toISOString() };
  await saveState(state, logPath);
  await log({ phase: "dumped", bytes: st.size, sha });
  console.log(`  dumped ${(st.size / 1e6).toFixed(1)} MB sha256=${sha.slice(0, 16)}… snapshotAt=${snapshotAt}`);
  if (dumpOnly) {
    console.log("\n--dump-only: stopping after dump. Re-run with --apply --use-dump to continue.");
    return;
  }

  // ---- Phase 2: create role + database (ADMIN_URL only, seconds of privilege).
  console.log("\n[2/5] create role + database…");
  const q = (s: string) => s.replace(/'/g, "''");
  try {
    await psql(adminUrl!, `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${q(appRole)}') THEN CREATE ROLE "${appRole}" LOGIN; END IF; END $$;`);
    if (targetExists && state.phase !== "complete") {
      console.log("  incomplete prior state — dropping + recreating target (drop-and-restart contract)");
      await psql(adminUrl!, `DROP DATABASE IF EXISTS "${targetDb}";`);
    }
    await psql(adminUrl!, `SELECT 1 FROM pg_database WHERE datname='${q(targetDb)}';`).then(async (r) => {
      if (r.trim() !== "1") await psql(adminUrl!, `CREATE DATABASE "${targetDb}" OWNER "${appRole}";`);
    });
    await psql(adminUrl!, `GRANT ALL PRIVILEGES ON DATABASE "${targetDb}" TO "${appRole}";`, targetDb);
  } catch (e) {
    fail(classify("psql-create", e), logPath);
  }
  state.phase = "created";
  await saveState(state, logPath);
  console.log("  role + database ready");

  // ---- Phase 3: restore into the fresh, empty database (no conflicts possible).
  console.log("\n[3/5] pg_restore…");
  // Target connection: explicit TARGET_DATABASE_URL wins; otherwise reuse ADMIN_URL's
  // host/credentials pointed at the new database (peer-socket servers: run as postgres OS user).
  const targetUrl = process.env.TARGET_DATABASE_URL ?? withDb(adminUrl!, targetDb);
  try {
    await run("pg_restore", "pg_restore", ["-j", jobs, "--no-owner", "--no-privileges", `--role=${appRole}`, "-d", targetUrl, dumpPath]);
  } catch (e) {
    fail({ ...classify("pg_restore", e), reason: `${classify("pg_restore", e).reason} Resume: re-run --apply --use-dump ${dumpPath} (target is dropped + recreated, never half-restored).` }, logPath);
  }
  state.phase = "restored";
  await saveState(state, logPath);
  await log({ phase: "restored" });
  console.log("  restore done");

  // ---- Phase 4: verify — counts, migrations, smoke reads (all through the target DB).
  console.log("\n[4/5] verify…");
  const counts: Record<string, { source: number; target: number }> = {};
  let mismatches = 0;
  // targetUrl was resolved in phase 3 (explicit TARGET_DATABASE_URL or admin URL repointed).
  for (const t of TABLES) {
    try {
      const [s, g] = await Promise.all([
        run("verify", "psql", [neonUrl, "-tA", "-c", `SELECT COUNT(*) FROM "${t}";`]),
        run("verify", "psql", [targetUrl, "-tA", "-c", `SELECT COUNT(*) FROM "${t}";`]).catch(() =>
          run("verify", "psql", [withDb(adminUrl!, targetDb), "-tA", "-c", `SELECT COUNT(*) FROM "${t}";`])),
      ]);
      const sv = Number(s.trim()), gv = Number(g.trim());
      counts[t] = { source: sv, target: gv };
      if (sv !== gv) {
        mismatches++;
        console.log(`  MISMATCH ${t}: source=${sv} target=${gv}`);
      }
    } catch (e) {
      const c = classify("verify", e);
      console.log(`  VERIFY-FAILED ${t}: code=${c.code} error="${c.message}" reason: ${c.reason}`);
      mismatches++;
    }
  }
  try {
    const mig = await run("verify", "psql", [withDb(adminUrl!, targetDb), "-tA", "-c", `SELECT COUNT(*) FROM "_prisma_migrations";`]);
    console.log(`  _prisma_migrations=${mig.trim()} (expect 32 + branch additions)`);
  } catch (e) {
    const c = classify("verify", e);
    console.log(`  VERIFY-FAILED migrations: code=${c.code} error="${c.message}"`);
    mismatches++;
  }
  // App users (including super-admins) ride along inside the dump — no separate creation step.
  // But a clone with zero active super-admins would lock everyone out, so assert at least one.
  // Fix path (deliberately manual, passwords must never flow through this script):
  //   TARGET_DATABASE_URL=<new-db> npx tsx scripts/create-super-admin.ts
  try {
    const sa = await run("verify", "psql", [withDb(adminUrl!, targetDb), "-tA", "-c",
      `SELECT COUNT(*) FROM "User" WHERE role='super-admin' AND status='active';`]);
    console.log(`  active super-admins=${sa.trim()}`);
    if (Number(sa.trim()) < 1) {
      console.log("  VERIFY-FAILED super-admin: zero active super-admins — create one with scripts/create-super-admin.ts pointed at the new DB, then re-run verify.");
      mismatches++;
    }
  } catch (e) {
    const c = classify("verify", e);
    console.log(`  VERIFY-FAILED super-admin: code=${c.code} error="${c.message}"`);
    mismatches++;
  }
  state.phase = "verified";
  state.counts = counts;
  await saveState(state, logPath);
  if (mismatches) {
    console.log(`\nVERIFY FAILED with ${mismatches} mismatch(es) — do not proceed. See log: ${logPath}`);
    process.exit(1);
  }
  console.log("  all counts match");

  // ---- Phase 5: handoff.
  state.phase = "complete";
  await saveState(state, logPath);
  const handoff = { snapshotAt, dumpPath, dumpSha256: state.dumpSha256, targetDb, appRole };
  await writeFile(`${LOCAL_DIR}/clone-handoff.json`, JSON.stringify(handoff, null, 2));
  console.log(`\n=== COMPLETE ===
  snapshotAt (delta cutoff): ${snapshotAt}
  Run the delta later as:
    CUTOFF_ISO=${snapshotAt} npx tsx scripts/sync-neon-delta.ts --db-host-source <neon-host> --db-host-target <office-host> --auto
  Then: blob delta copy → backfill --apply → broker deploy (§9 runbook).
  Handoff: ${LOCAL_DIR}/clone-handoff.json   Log: ${logPath}`);
}

// Run only when executed directly, so helpers stay importable by tests.
if (process.argv[1] && /clone-neon-to-production\.(ts|js)$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(`FATAL error="${String((e as Error)?.message ?? e)}" — no state was advanced past the last saved phase; re-run resumes per the drop-and-restart contract.`);
    process.exit(1);
  });
}
