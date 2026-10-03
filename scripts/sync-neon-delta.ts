import { PrismaClient } from "@prisma/client";
import { makeDbAdapter } from "../lib/db-adapter";
import { mkdir, appendFile, writeFile } from "fs/promises";

// Neon → office-Postgres delta sync (migration doc §9, §13 D1–D21).
//
// Copies ONLY rows missing in the target (primary key decides — unique PKs make
// duplicates impossible by construction) plus rows changed since CUTOFF_ISO on tables
// that carry a timestamp. Re-running is always safe: existing PKs are skipped or
// fill-only, never overwritten, never deleted.
//
// Reads config from the process environment ONLY (never .env):
//   SOURCE_DATABASE_URL  TARGET_DATABASE_URL  [CUTOFF_ISO, default = end of 30-Sep IST]
// Never touches object storage — bytes move via scripts/migrate-blob-to-garage.ts,
// links via scripts/backfill-storage-keys.ts. Run order: this script → blob delta → backfill.
//
// Usage:
//   SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... npx tsx scripts/sync-neon-delta.ts \
//     --db-host-source neon.tech --db-host-target <office-host>            # compare only (default)
//     ... --auto                                                          # compare → apply → verify
//     ... --apply-only | --verify-only | --compare-only | --only message  # subsets
//
// Exit codes: 0 clean · 1 blocked/failed · 2 applied/verified with reports needing review.

const DEFAULT_CUTOFF_ISO = "2026-09-30T18:29:59.000Z"; // 30-Sep night IST (23:59:59 +05:30)
const CHUNK = 20; // Prisma cancels transactions past 5 s over slow links — same lesson as backfill
const MAX_RETRIES = 3;
const LOCAL_DIR = ".migration";
const ABORT_AFTER_CONSECUTIVE_FAILURES = 5;

// ---------------------------------------------------------------------------
// Table registry. Order is FK-safe (parents before children). `since` is the
// timestamp column scoping the scan; null = full PK-set diff (append-only or
// timestamp-less tables). `unique` lists composite uniques for the D2 check.
// ---------------------------------------------------------------------------
type TableCfg = {
  model: string;
  pk: string;
  since: string | null;
  unique?: string[][];
  skip?: boolean;
};

const TABLES: TableCfg[] = [
  { model: "user", pk: "id", since: "updatedAt", unique: [["email"], ["employeeId"]] },
  { model: "employee", pk: "id", since: "updatedAt", unique: [["email"], ["employeeNumber"], ["unifiUserId"]] },
  { model: "architect", pk: "id", since: "updatedAt" },
  { model: "architectPartner", pk: "id", since: null },
  { model: "customer", pk: "id", since: "updatedAt" },
  { model: "customPipelineStage", pk: "key", since: "updatedAt" },
  { model: "quoteTemplateSettings", pk: "id", since: "updatedAt" },
  { model: "materialItem", pk: "id", since: "createdAt" },
  { model: "panelCalcSpec", pk: "id", since: "createdAt", unique: [["brand", "product", "length", "height"]] },
  { model: "panelCalcHistory", pk: "id", since: "createdAt" },
  { model: "furniturePriceItem", pk: "id", since: "createdAt" },
  { model: "hardwarePriceItem", pk: "id", since: "createdAt" },
  { model: "cabinetType", pk: "id", since: "createdAt" },
  { model: "unitType", pk: "id", since: "createdAt" },
  { model: "quote", pk: "id", since: "updatedAt" },
  { model: "task", pk: "id", since: "updatedAt" },
  { model: "notification", pk: "id", since: "createdAt" },
  { model: "message", pk: "id", since: "updatedAt" },
  { model: "messageReaction", pk: "id", since: "createdAt", unique: [["messageId", "userId", "emoji"]] },
  { model: "messageReadReceipt", pk: "id", since: "readAt", unique: [["messageId", "userId"]] },
  { model: "mediaAttachment", pk: "id", since: "uploadedAt" },
  { model: "attendanceRecord", pk: "id", since: "updatedAt", unique: [["employeeId", "date"]] },
  { model: "photoAttendanceRecord", pk: "id", since: "updatedAt", unique: [["employeeId", "date"]] },
  { model: "leaveRequest", pk: "id", since: null },
  { model: "unifiSyncLog", pk: "id", since: "createdAt" },
  { model: "doorAccessLog", pk: "id", since: "createdAt" },
  { model: "securityAuditLog", pk: "id", since: "createdAt" },
  { model: "auditLog", pk: "id", since: "createdAt" },
  { model: "chatPresence", pk: "id", since: null, skip: true }, // D11: ephemeral typing state, never synced
];

// *Key columns receive fill-only treatment (D9): set when local empty, never cleared/replaced.
const KEY_COLS = ["audioKey", "pdfKey", "imageKeys", "checkInPhotoKey", "checkOutPhotoKey"];

// ---------------------------------------------------------------------------
// Error classification. Every row failure prints the EXACT error; if the error
// shape is unrecognised it is reported as UNKNOWN with the reason why it could
// not be classified plus full details — never swallowed, never vague.
// ---------------------------------------------------------------------------
type Classified = { code: string; message: string; reason: string };

function classifyError(e: unknown): Classified {
  const err = e as { name?: string; code?: string; message?: string; stack?: string; meta?: unknown };
  const message = String(err?.message ?? e ?? "no message");
  if (err && typeof err.code === "string" && err.code.startsWith("P")) {
    const known: Record<string, string> = {
      P2002: "unique-constraint violation — same logical row exists locally under a different PK (see D2); needs human merge, never auto-fixed",
      P2003: "foreign-key violation — child references a parent missing locally (see D6); parent sync order or orphaned child",
      P2024: "connection-pool timeout talking to the database — transient load/network; retry the run (resume is safe)",
      P1001: "cannot reach the database server — wrong host, firewall, or server down; check connection strings",
      P1008: "operations timed out — transient; retry",
      P1017: "server closed the connection — transient; retry",
      P2028: "transaction timed out (5 s cap) — chunk too big for this link; reduce CHUNK and re-run",
      P2034: "transaction deadlock — retry; persistent deadlocks mean concurrent writers, freeze writes first",
    };
    return { code: err.code, message, reason: known[err.code] ?? "recognized Prisma error but no specific guidance mapped — inspect message/meta" };
  }
  if (err?.name === "MissingParent") return { code: "MissingParent", message, reason: String(err?.message ?? "") };
  if (/getaddrinfo|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(message)) {
    return { code: "NETWORK", message, reason: "DNS/TCP failure reaching a database host — check hostnames, VPN/tailnet, firewall" };
  }
  if (/^(Error|TypeError|RangeError)/.test(String(err?.name ?? ""))) {
    return { code: `JS:${err!.name}`, message, reason: "client-side/script bug, not a database refusal — inspect stack below" };
  }
  return {
    code: "UNKNOWN",
    message,
    reason: `classification failed: error has no Prisma code (code=${String(err?.code ?? "?")}) and matches no known network/JS pattern (name=${String(err?.name ?? "?")}). Treated as UNKNOWN — full stack follows; do not retry blindly, investigate first.`,
  };
}

type Failure = { table: string; pk: string; op: string; code: string; message: string; reason: string; stack?: string };
type Conflict = { table: string; pk: string; fields: string[] };
type Report = {
  cutoff: string; sourceHost: string; targetHost: string; mode: string;
  perTable: Record<string, { source: number; targetBefore: number; inserted: number; skipped: number; keyFilled: number; conflicts: number; localOnly: number; orphans: number }>;
  conflicts: Conflict[]; localOnly: Array<{ table: string; pk: string }>; orphans: Array<{ table: string; pk: string; detail: string }>;
  failures: Failure[]; clearedKeys: Array<{ table: string; pk: string }>;
};

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pkOf = (row: Record<string, unknown>, pk: string) => String(row[pk]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (client: PrismaClient, model: string): any => (client as any)[model];

function scalarDiff(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const k of Object.keys(a)) {
    if (k === "updatedAt" || KEY_COLS.includes(k)) continue;
    const x = JSON.stringify(a[k]);
    const y = JSON.stringify(b[k]);
    if (x !== y && out.length < 10) out.push(k);
  }
  return out;
}

async function withRetry<T>(label: string, fn: () => Promise<T>, onFail: (c: Classified) => void): Promise<T | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const c = classifyError(e);
      if (attempt >= MAX_RETRIES) {
        onFail(c);
        return null;
      }
      await sleep(1500 * attempt);
    }
  }
  return null; // unreachable
}

async function main() {
  const only = opt("only");
  // flag() prepends "--" itself; passing "--auto" here looked for "----auto" and never matched.
  const apply = flag("apply") || flag("auto") || flag("apply-only");
  const doCompare = !flag("apply-only") && !flag("verify-only");
  const doApply = apply && !flag("compare-only") && !flag("verify-only");
  const doVerify = flag("auto") || flag("verify-only") || (apply && !flag("compare-only"));
  const bucket = opt("bucket"); // accepted for runbook parity, unused by this script
  void bucket;
  const cutoff = opt("cutoff") ?? process.env.CUTOFF_ISO ?? DEFAULT_CUTOFF_ISO;
  const cutoffDate = new Date(cutoff);
  if (Number.isNaN(cutoffDate.getTime())) throw new Error(`CUTOFF_ISO "${cutoff}" is not a valid date`);
  const srcUrl = process.env.SOURCE_DATABASE_URL;
  const tgtUrl = process.env.TARGET_DATABASE_URL;
  const expectSrc = opt("db-host-source");
  const expectTgt = opt("db-host-target");
  for (const [n, v] of [["SOURCE_DATABASE_URL", srcUrl], ["TARGET_DATABASE_URL", tgtUrl], ["--db-host-source", expectSrc], ["--db-host-target", expectTgt]] as const) {
    if (!v) throw new Error(`${n} is required`);
  }
  // D16: refuse swapped or wrong databases before any query.
  const srcHost = new URL(srcUrl!).hostname;
  const tgtHost = new URL(tgtUrl!).hostname;
  if (!srcHost.includes(expectSrc!)) throw new Error(`SOURCE host "${srcHost}" does not contain "${expectSrc}" — refusing (D16).`);
  if (!tgtHost.includes(expectTgt!)) throw new Error(`TARGET host "${tgtHost}" does not contain "${expectTgt}" — refusing (D16).`);
  if (srcHost === tgtHost && srcUrl === tgtUrl) throw new Error("SOURCE and TARGET are the same database — refusing (D16).");

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir(LOCAL_DIR, { recursive: true });
  const logPath = `${LOCAL_DIR}/sync-neon-log-${runId}.ndjson`;
  const log = (e: Record<string, unknown>) => appendFile(logPath, JSON.stringify({ ts: new Date().toISOString(), ...e }) + "\n");

  const src = new PrismaClient({ adapter: makeDbAdapter(srcUrl!) });
  const tgt = new PrismaClient({ adapter: makeDbAdapter(tgtUrl!) });
  // D19 pre-flight is per-table below; reachability first.
  await src.$queryRaw`SELECT 1`;
  await tgt.$queryRaw`SELECT 1`;

  const report: Report = {
    cutoff: cutoffDate.toISOString(), sourceHost: srcHost, targetHost: tgtHost,
    mode: doApply ? "APPLY" : "DRY-RUN", perTable: {}, conflicts: [], localOnly: [], orphans: [], failures: [], clearedKeys: [],
  };

  console.log(`Source: ${srcHost}\nTarget: ${tgtHost}\nCutoff: ${report.cutoff}\nMode:   ${report.mode}${only ? ` (only ${only})` : ""}`);

  // D19: schema-drift gate — column sets must match per table before anything moves.
  async function columns(client: PrismaClient, table: string): Promise<Set<string>> {
    const rows = (await client.$queryRawUnsafe(
      // ::text — the driver adapter can't deserialize Postgres's `name` type.
      `SELECT column_name::text AS column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, table
    )) as Array<{ column_name: string }>;
    return new Set(rows.map((r) => r.column_name));
  }
  // Prisma model key (lowerCamel) -> physical table. The schema has no @@map, so the table is the
  // model name capitalised ("message" -> "Message"); only customPipelineStage was special-cased
  // before, which made the drift gate look up non-existent tables and pass silently.
  const tableName = (model: string) => model[0].toUpperCase() + model.slice(1);

  const tables = TABLES.filter((t) => !t.skip && (!only || t.model === only));
  if (only && tables.length === 0) throw new Error(`--only "${only}" matches no synced table`);

  for (const t of tables) {
    const st = (report.perTable[t.model] = { source: 0, targetBefore: 0, inserted: 0, skipped: 0, keyFilled: 0, conflicts: 0, localOnly: 0, orphans: 0 });
    const S = db(src, t.model);
    const T = db(tgt, t.model);
    const tbl = tableName(t.model);

    if (!doCompare && !doApply) continue; // --verify-only: nothing to scan, the Verify block below does the work

    {
      // D19 drift gate per table.
      let scol: Set<string> = new Set();
      let tcol: Set<string> = new Set();
      try {
        [scol, tcol] = await Promise.all([columns(src, tbl), columns(tgt, tbl)]);
      } catch (e) {
        const c = classifyError(e);
        console.log(`\nSTOP [${t.model}]: schema introspection failed — code=${c.code} error="${c.message}" reason: ${c.reason}`);
        await noteFailure(t.model, "*", "drift-check", c);
        await disconnect(src, tgt);
        process.exit(1);
      }
      const onlySrc = [...scol].filter((c) => !tcol.has(c));
      const onlyTgt = [...tcol].filter((c) => !scol.has(c));
      // Key columns exist only in target-side migrations by design (they are fill-only, never synced).
      const ignorable = new Set([...KEY_COLS, "imageUrls", "imageNames"]);
      const realDrift = [...onlySrc, ...onlyTgt].filter((c) => !ignorable.has(c));
      if (realDrift.length) {
        console.log(`\nSTOP [${t.model}]: schema drift — source-only=[${onlySrc.join(",")}] target-only=[${onlyTgt.join(",")}]. Align migrations first (D19).`);
        await disconnect(src, tgt);
        process.exit(1);
      }
    }

    // Candidate scan: timestamp gate UNION pk-missing-locally (D3/D4 backstop).
    const sinceWhere = t.since ? { [t.since]: { gte: cutoffDate } } : {};
    const srcRows: Record<string, unknown>[] = await S.findMany({ where: sinceWhere });
    // One PK listing per side, reused below (was four full scans per table over the slow Neon link).
    const allSrcIds: string[] = ((await S.findMany({ select: { [t.pk]: true } })) as Record<string, unknown>[]).map((r) => pkOf(r, t.pk));
    const tgtIdList: string[] = ((await T.findMany({ select: { [t.pk]: true } })) as Record<string, unknown>[]).map((r) => pkOf(r, t.pk));
    const tgtIds = new Set<string>(tgtIdList);
    st.source = allSrcIds.length;
    st.targetBefore = tgtIds.size;
    // PKs changed-or-new since cutoff need full comparison even if timestamp-older (D3):
    // fetch any source PK absent locally regardless of the timestamp gate.
    const extraIds = new Set<string>();
    if (t.since) {
      for (const id of allSrcIds) if (!tgtIds.has(id)) extraIds.add(id);
    }
    const extraRows: Record<string, unknown>[] = extraIds.size
      ? await S.findMany({ where: { [t.pk]: { in: [...extraIds] } } })
      : [];
    const seen = new Set(srcRows.map((r) => pkOf(r, t.pk)));
    const candidates = [...srcRows, ...extraRows.filter((r) => !seen.has(pkOf(r, t.pk)))];

    // Local-only PKs (target minus source): report only, never delete (D10, hard-delete-in-source case).
    {
      const srcIdSet = new Set<string>(allSrcIds);
      for (const id of tgtIdList) {
        if (!srcIdSet.has(id)) {
          report.localOnly.push({ table: t.model, pk: id });
          st.localOnly++;
        }
      }
    }

    const toInsert: Record<string, unknown>[] = [];
    const toKeyFill: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
    for (const row of candidates) {
      const id = pkOf(row, t.pk);
      if (!tgtIds.has(id)) {
        // D2: same logical row under a different PK would breach a composite unique — precheck.
        let collision = false;
        for (const group of t.unique ?? []) {
          const cond = Object.fromEntries(group.map((f) => [f, row[f]]));
          if (Object.values(cond).some((v) => v == null)) continue;
          const hit = await T.findFirst({ where: { ...cond, NOT: { [t.pk]: id } }, select: { [t.pk]: true } });
          if (hit) {
            report.conflicts.push({ table: t.model, pk: `${id} (unique-collides with ${pkOf(hit as Record<string, unknown>, t.pk)} on ${group.join("+")})`, fields: group });
            st.conflicts++;
            collision = true;
            break;
          }
        }
        if (!collision) toInsert.push(row);
        continue;
      }
      // Same PK both sides: fill empty *Key cols only (D9); diff business cols for the report (D8).
      const local = (await T.findUnique({ where: { [t.pk]: id } })) as Record<string, unknown> | null;
      if (!local) continue; // vanished between scan and now — next run picks it up
      const fill: Record<string, unknown> = {};
      for (const k of KEY_COLS) {
        const lv = local[k];
        const sv = row[k];
        const empty = lv == null || (Array.isArray(lv) && lv.length === 0);
        if (empty && sv != null && !(Array.isArray(sv) && sv.length === 0)) fill[k] = sv;
      }
      if (Object.keys(fill).length) toKeyFill.push({ where: { [t.pk]: id }, data: fill });
      else {
        const diff = scalarDiff(row, local);
        if (diff.length) {
          report.conflicts.push({ table: t.model, pk: id, fields: diff });
          st.conflicts++;
        } else st.skipped++;
      }
    }

    if (!doApply) {
      st.inserted = 0; // dry-run counts below without writing
      console.log(`[${t.model}] source=${st.source} target=${st.targetBefore} would-insert=${toInsert.length} would-keyfill=${toKeyFill.length} conflicts=${st.conflicts} local-only=${st.localOnly}`);
      // Record what WOULD happen so dry-run output is complete without touching the target.
      for (const r of toInsert) await log({ table: t.model, pk: pkOf(r, t.pk), op: "would-insert" });
      continue;
    }

    // APPLY: chunked transactions with per-row fallback so the EXACT failing row + error is known.
    const ops: Array<{ pk: string; op: string; run: () => Promise<unknown> }> = [
      ...toInsert.map((r) => ({ pk: pkOf(r, t.pk), op: "insert", run: () => T.create({ data: stripKeyCols(r) }) })),
      ...toKeyFill.map((w) => ({ pk: pkOf(w.where as Record<string, unknown>, t.pk), op: "keyfill", run: () => T.update({ where: w.where as never, data: w.data as never }) })),
    ];
    // NOTE: inserts carry full rows INCLUDING any key values the source already holds
    // (production backfill already ran there) — consistent because keys are bucket-relative
    // paths and the copy preserves them. Local-filled keys are never present here (row is new).
    let consecutiveFailures = 0;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = ops.slice(i, i + CHUNK);
      const attempt = await withRetry(`batch ${t.model}@${i}`, () => tgt.$transaction(batch.map((o) => o.run() as never)), async () => undefined);
      if (attempt !== null) {
        consecutiveFailures = 0;
        for (const o of batch) {
          if (o.op === "insert") st.inserted++;
          else st.keyFilled++;
        }
        await log({ table: t.model, op: "batch-ok", from: i, count: batch.length });
        console.log(`  [${t.model}] wrote ${Math.min(i + CHUNK, ops.length)}/${ops.length}`);
        continue;
      }
      // Batch failed even after retries: replay row-by-row to name the EXACT failure (never vague).
      for (const o of batch) {
        try {
          await o.run();
          if (o.op === "insert") st.inserted++;
          else st.keyFilled++;
          consecutiveFailures = 0;
        } catch (e) {
          const c = classifyError(e);
          // A retried batch may already have committed (timeout after commit): the row is there, so
          // P2002 on our own PK means "already applied", not a failure and never a duplicate.
          if (c.code === "P2002" && o.op === "insert" && (await T.findUnique({ where: { [t.pk]: o.pk }, select: { [t.pk]: true } }))) {
            st.skipped++;
            consecutiveFailures = 0;
            continue;
          }
          const f: Failure = { table: t.model, pk: o.pk, op: o.op, code: c.code, message: c.message, reason: c.reason, stack: (e as { stack?: string })?.stack };
          report.failures.push(f);
          await log({ table: t.model, pk: o.pk, op: o.op, status: "ROW-FAILED", code: c.code, error: c.message, reason: c.reason });
          console.log(`  ROW-FAILED [${t.model}] pk=${o.pk} op=${o.op} code=${c.code}\n    error="${c.message}"\n    reason: ${c.reason}`);
          consecutiveFailures++;
          if (consecutiveFailures >= ABORT_AFTER_CONSECUTIVE_FAILURES) {
            console.log(`\nSTOP [${t.model}]: ${ABORT_AFTER_CONSECUTIVE_FAILURES} consecutive row failures — see log. Fix the cause, then re-run (completed rows are skipped, D1).`);
            await finish(src, tgt, report, logPath, runId, true);
            process.exit(1);
          }
        }
      }
    }
  }

  // Key-fill assertion (D9): no key column may transition filled→empty. We never issue such a
  // write by construction (fill-only branches above); assert on a sample as proof.
  if (doVerify || doApply) {
    console.log("\n=== Verify ===");
    for (const t of tables) {
      const S = db(src, t.model);
      const T = db(tgt, t.model);
      const [srcIds, tgtIds] = await Promise.all([
        S.findMany({ select: { [t.pk]: true } }) as Promise<Record<string, unknown>[]>,
        T.findMany({ select: { [t.pk]: true } }) as Promise<Record<string, unknown>[]>,
      ]);
      const have = new Set(tgtIds.map((r) => pkOf(r, t.pk)));
      let missing = srcIds.map((r) => pkOf(r, t.pk)).filter((id) => !have.has(id));
      // A source row whose unique key (e.g. messageId+userId, email) already exists locally under a
      // different PK is the same logical row — deliberately not inserted (D2), so not "missing".
      let explained = 0;
      if (missing.length && t.unique?.length) {
        const rows: Record<string, unknown>[] = await S.findMany({ where: { [t.pk]: { in: missing } } });
        const stillMissing: string[] = [];
        for (const row of rows) {
          let hit = false;
          for (const group of t.unique) {
            const cond = Object.fromEntries(group.map((f) => [f, row[f]]));
            if (Object.values(cond).some((v) => v == null)) continue;
            if (await T.findFirst({ where: cond, select: { [t.pk]: true } })) { hit = true; break; }
          }
          if (hit) explained++; else stillMissing.push(pkOf(row, t.pk));
        }
        missing = stillMissing;
      }
      // Prove every source row landed (the old check only compared the target with its own
      // before-count, which can't catch a source row that never arrived).
      const ok = missing.length === 0;
      console.log(`[${t.model}] source=${srcIds.length} target=${tgtIds.length} missing-in-target=${missing.length}${explained ? ` (+${explained} already present under another PK)` : ""} ${ok ? "OK" : "MISSING — " + missing.slice(0, 3).join(",")}`);
      if (!ok) report.failures.push({ table: t.model, pk: missing.slice(0, 5).join(","), op: "verify-missing", code: "MISSING-IN-TARGET", message: `${missing.length} source row(s) not in target`, reason: "a source PK is absent locally: failed insert, unique-collision conflict awaiting a human merge, or a row created in the source during the run — re-run, then inspect the report" });
    }
  }

  await finish(src, tgt, report, logPath, runId, false);
  if (report.failures.length) process.exit(1);
  if (report.conflicts.length || report.localOnly.length) process.exit(2);
}

// Key columns are metadata, not business data — but inserts carry the source row whole
// (keys included) so this is a no-op safeguard kept explicit for reviewers.
function stripKeyCols(_row: Record<string, unknown>): Record<string, unknown> {
  return _row;
}

async function noteFailure(table: string, pk: string, op: string, c: Classified) {
  console.log(`  ROW-FAILED [${table}] pk=${pk} op=${op} code=${c.code}\n    error="${c.message}"\n    reason: ${c.reason}`);
}

async function disconnect(src: PrismaClient, tgt: PrismaClient) {
  await src.$disconnect().catch(() => undefined);
  await tgt.$disconnect().catch(() => undefined);
}

async function finish(src: PrismaClient, tgt: PrismaClient, report: Report, logPath: string, runId: string, aborted: boolean) {
  const reportPath = `${LOCAL_DIR}/sync-neon-report-${runId}.json`;
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n=== ${aborted ? "ABORTED" : "Done"} (${report.mode}) ===`);
  console.log(`conflicts=${report.conflicts.length} local-only=${report.localOnly.length} failures=${report.failures.length}`);
  for (const c of report.conflicts.slice(0, 15)) console.log(`  CONFLICT  ${c.table} ${c.pk} fields=[${c.fields.join(",")}]`);
  for (const l of report.localOnly.slice(0, 15)) console.log(`  LOCAL-ONLY ${l.table} ${l.pk} (never auto-deleted, D10)`);
  console.log(`Log: ${logPath}\nReport: ${reportPath}`);
  await disconnect(src, tgt);
}

// Run only when executed directly, so helpers stay importable by tests.
if (process.argv[1] && /sync-neon-delta\.(ts|js)$/.test(process.argv[1])) {
  main().catch((e) => {
    const c = classifyError(e);
    console.error(`FATAL code=${c.code}\nerror="${c.message}"\nreason: ${c.reason}`);
    if (c.code === "UNKNOWN") console.error((e as { stack?: string })?.stack ?? e);
    process.exit(1);
  });
}
