import { PrismaClient } from "@prisma/client";
import { makeDbAdapter } from "../lib/db-adapter";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "fs/promises";

// Fills the new *Key columns from the old Blob URLs and audits every attachment reference
// against what is actually in the Garage bucket (migration doc §8.6, §9.5, §9.6).
//
// ADDITIVE ONLY: it never edits or clears an old *Url column. The one exception to "fill the
// new columns only" is normalising legacy single-image rows (imageUrl set, imageUrls empty)
// into arrays — that only fills EMPTY arrays. Idempotent: rows that already have keys are skipped.
//
// A key is only written if that object EXISTS in the bucket, so "resolved" already means
// "the file is really there". Unresolved references are reported as MISSING, never guessed.
//
// Reads config from the process environment ONLY (never .env) and refuses to run unless you
// name the database host you expect, so it cannot silently hit production:
//   DATABASE_URL  S3_ENDPOINT  S3_ACCESS_KEY_ID  S3_SECRET_ACCESS_KEY  [S3_REGION=garage]
//
// Usage:
//   DATABASE_URL=... npx tsx scripts/backfill-storage-keys.ts --bucket modusys-staging --db-host <host-substring>
//   ... add --apply to actually write (default is a dry run that only reports)
//
// Exit codes: 0 clean · 1 blocking problem / bad usage · 2 applied or audited, but some references are MISSING.

const META_PREFIX = "_migration/";
const CHUNK = 200;

// A Blob URL path IS the object key (uploads used addRandomSuffix:false / the same key was copied).
// Try the decoded path first, then the raw path, so spaces and unicode match either way.
export function keyCandidates(url: string): string[] {
  try {
    const raw = new URL(url).pathname.replace(/^\//, "");
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      /* keep raw */
    }
    return decoded === raw ? [raw] : [decoded, raw];
  } catch {
    return [];
  }
}

export function resolveKey(url: string | null | undefined, present: Set<string>): string | null {
  if (!url) return null;
  return keyCandidates(url).find((k) => present.has(k)) ?? null;
}

async function listBucketKeys(bucket: string): Promise<Set<string>> {
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "garage",
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const o of page.Contents ?? []) if (o.Key && !o.Key.startsWith(META_PREFIX)) keys.add(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

type Missing = { table: string; id: string; field: string; key: string };

async function main() {
  const argv = process.argv.slice(2);
  const opt = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const apply = argv.includes("--apply");
  const bucket = opt("bucket");
  const expectHost = opt("db-host");
  if (!bucket || !expectHost) throw new Error("--bucket <name> and --db-host <expected host substring> are required");
  for (const v of ["DATABASE_URL", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
    if (!process.env[v]) throw new Error(`${v} is not set in the environment`);
  }
  const dbHost = new URL(process.env.DATABASE_URL!).hostname;
  if (!dbHost.includes(expectHost)) {
    throw new Error(`DATABASE_URL host "${dbHost}" does not contain "${expectHost}" — refusing to run.`);
  }
  console.log(`Database: ${dbHost}\nBucket:   ${bucket} @ ${process.env.S3_ENDPOINT}\nMode:     ${apply ? "APPLY (writes)" : "DRY RUN (no writes)"}`);

  const prisma = new PrismaClient({ adapter: makeDbAdapter(process.env.DATABASE_URL!) });
  await prisma.$queryRaw`SELECT 1`; // Postgres reachable (§9 step 0)
  const present = await listBucketKeys(bucket);
  console.log(`Garage objects (excluding ${META_PREFIX}): ${present.size}`);

  const missing: Missing[] = [];
  let blocking = 0; // unresolved check-in on the legacy table, whose URL column is NOT NULL (§8.6 step 4)
  const referenced = new Set<string>();
  const stats = { messagesFilled: 0, messagesAlready: 0, mediaOk: 0, mediaMissing: 0, attFilled: 0, photoFilled: 0 };
  const writes: Array<() => Promise<unknown>> = [];

  // ---- Chat messages
  const messages = await prisma.message.findMany({
    where: { OR: [{ audioUrl: { not: null } }, { imageUrl: { not: null } }, { imageUrls: { isEmpty: false } }, { pdfUrl: { not: null } }] },
    select: { id: true, audioUrl: true, audioKey: true, imageUrl: true, imageName: true, imageUrls: true, imageNames: true, imageKeys: true, pdfUrl: true, pdfKey: true },
  });
  for (const m of messages) {
    const data: Record<string, unknown> = {};
    if (m.audioUrl && !m.audioKey) {
      const k = resolveKey(m.audioUrl, present);
      if (k) data.audioKey = k;
      else missing.push({ table: "Message", id: m.id, field: "audio", key: keyCandidates(m.audioUrl)[0] ?? "?" });
    }
    if (m.pdfUrl && !m.pdfKey) {
      const k = resolveKey(m.pdfUrl, present);
      if (k) data.pdfKey = k;
      else missing.push({ table: "Message", id: m.id, field: "pdf", key: keyCandidates(m.pdfUrl)[0] ?? "?" });
    }
    // Legacy rows may hold only the scalar imageUrl — treat it as a one-item gallery.
    const urls = m.imageUrls.length ? m.imageUrls : m.imageUrl ? [m.imageUrl] : [];
    if (urls.length && m.imageKeys.length === 0) {
      const keys = urls.map((u) => resolveKey(u, present));
      if (keys.every((k): k is string => !!k)) {
        data.imageKeys = keys;
        // Only ever fills EMPTY arrays, so removeImageIndex can splice keys/urls/names in step.
        if (m.imageUrls.length === 0) data.imageUrls = [m.imageUrl];
        if (m.imageNames.length === 0 && m.imageName) data.imageNames = [m.imageName];
      } else {
        // Keys are positional, so a partial set would misalign names — flag the whole gallery instead.
        urls.forEach((u, i) => {
          if (!keys[i]) missing.push({ table: "Message", id: m.id, field: `image[${i}]`, key: keyCandidates(u)[0] ?? "?" });
        });
      }
    }
    for (const k of [m.audioKey, m.pdfKey, ...m.imageKeys]) if (k) referenced.add(k);
    for (const k of [data.audioKey, data.pdfKey, ...((data.imageKeys as string[] | undefined) ?? [])]) if (typeof k === "string") referenced.add(k);
    if (Object.keys(data).length) {
      stats.messagesFilled++;
      writes.push(() => prisma.message.update({ where: { id: m.id }, data }));
    } else if (m.audioKey || m.pdfKey || m.imageKeys.length) stats.messagesAlready++;
  }

  // ---- Customer gallery: `pathname` already IS the key — nothing to fill, only to audit.
  for (const a of await prisma.mediaAttachment.findMany({ select: { id: true, pathname: true } })) {
    if (present.has(a.pathname)) {
      stats.mediaOk++;
      referenced.add(a.pathname);
    } else {
      stats.mediaMissing++;
      missing.push({ table: "MediaAttachment", id: a.id, field: "file", key: a.pathname });
    }
  }

  // ---- Attendance selfies (both tables)
  const attSelect = { id: true, checkInPhotoUrl: true, checkOutPhotoUrl: true, checkInPhotoKey: true, checkOutPhotoKey: true } as const;
  function photoData(table: string, id: string, r: { checkInPhotoUrl: string | null; checkOutPhotoUrl: string | null; checkInPhotoKey: string | null; checkOutPhotoKey: string | null }) {
    const data: { checkInPhotoKey?: string; checkOutPhotoKey?: string } = {};
    for (const side of ["checkIn", "checkOut"] as const) {
      const url = r[`${side}PhotoUrl`];
      const have = r[`${side}PhotoKey`];
      if (have) referenced.add(have);
      if (!url || have) continue;
      const k = resolveKey(url, present);
      if (k) {
        data[`${side}PhotoKey`] = k;
        referenced.add(k);
      } else {
        missing.push({ table, id, field: side, key: keyCandidates(url)[0] ?? "?" });
        if (table === "PhotoAttendanceRecord" && side === "checkIn") blocking++;
      }
    }
    return data;
  }
  for (const r of await prisma.attendanceRecord.findMany({ where: { OR: [{ checkInPhotoUrl: { not: null } }, { checkOutPhotoUrl: { not: null } }] }, select: attSelect })) {
    const data = photoData("AttendanceRecord", r.id, r);
    if (Object.keys(data).length) {
      stats.attFilled++;
      writes.push(() => prisma.attendanceRecord.update({ where: { id: r.id }, data }));
    }
  }
  for (const r of await prisma.photoAttendanceRecord.findMany({ select: attSelect })) {
    const data = photoData("PhotoAttendanceRecord", r.id, r);
    if (Object.keys(data).length) {
      stats.photoFilled++;
      writes.push(() => prisma.photoAttendanceRecord.update({ where: { id: r.id }, data }));
    }
  }

  // ---- Report
  const orphans = [...present].filter((k) => !referenced.has(k));
  console.log("\n=== Audit ===");
  console.log(`Messages:   ${stats.messagesFilled} to fill, ${stats.messagesAlready} already keyed`);
  console.log(`Gallery:    ${stats.mediaOk} resolve, ${stats.mediaMissing} missing`);
  console.log(`Attendance: ${stats.attFilled} unified rows to fill, ${stats.photoFilled} legacy rows to fill`);
  console.log(`MISSING references: ${missing.length}   |   orphan objects (in Garage, no row): ${orphans.length} (informational)`);
  for (const m of missing.slice(0, 15)) console.log(`  MISSING  ${m.table} ${m.id} ${m.field}`);
  await mkdir(".migration", { recursive: true });
  const reportPath = `.migration/backfill-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await writeFile(reportPath, JSON.stringify({ dbHost, bucket, apply, stats, missing, orphans }, null, 2));
  console.log(`Full report: ${reportPath}`);

  if (blocking) {
    console.log(`\nSTOP: ${blocking} legacy attendance check-in photo(s) have no object in the bucket. The migration must not proceed (§8.6).`);
    await prisma.$disconnect();
    process.exit(1);
  }
  if (!apply) {
    console.log(`\nDry run — nothing written. Re-run with --apply to write ${writes.length} row update(s).`);
  } else {
    for (let i = 0; i < writes.length; i += CHUNK) {
      await prisma.$transaction(writes.slice(i, i + CHUNK).map((w) => w() as never));
      console.log(`  wrote ${Math.min(i + CHUNK, writes.length)}/${writes.length}`);
    }
    console.log(`\nApplied ${writes.length} update(s). Re-run without --apply: it should now report 0 to fill.`);
  }
  await prisma.$disconnect();
  if (missing.length) process.exit(2);
}

// Run only when executed directly, so the pure helpers above can be imported by a test.
if (process.argv[1] && /backfill-storage-keys\.(ts|js)$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
