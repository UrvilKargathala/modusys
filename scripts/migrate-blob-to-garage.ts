import { list } from "@vercel/blob";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { mkdir, writeFile, appendFile, readFile } from "fs/promises";
import { randomBytes } from "crypto";

// Blob → Garage copy (migration doc §9). READ-ONLY against Vercel Blob: it only lists and
// downloads. It writes to the Garage bucket under IDENTICAL keys, so no remap table is needed.
//
// Resumable: a checkpoint manifest lives in the bucket (`_migration/checkpoint.json`) with a
// local copy in ./.migration/. Re-running skips keys already copied whose size still matches.
//
// Reads config from the process environment ONLY (never .env) so it can't silently pick up
// production values:
//   BLOB_READ_WRITE_TOKEN  S3_ENDPOINT  S3_ACCESS_KEY_ID  S3_SECRET_ACCESS_KEY  [S3_REGION=garage]
//
// Usage (the bucket is always explicit — production and staging are different buckets):
//   npx tsx scripts/migrate-blob-to-garage.ts --bucket modusys-staging --dry-run   # inventory only
//   npx tsx scripts/migrate-blob-to-garage.ts --bucket modusys-staging             # copy (resumable)
//   npx tsx scripts/migrate-blob-to-garage.ts --bucket modusys-staging --verify    # exact count + bytes
//     (--verify also takes --allow-extra when the bucket may hold objects Blob doesn't)

const CONCURRENCY = 8;
const RETRIES = 3;
const CHECKPOINT_EVERY = 50;
const META_PREFIX = "_migration/"; // excluded from verification; no DB row ever references it
const LOCAL_DIR = ".migration";

type Item = { key: string; url: string; size: number };
type Entry = { bytes: number; etag?: string; status: "done" | "failed" | "missing"; ts: string; error?: string };
type Checkpoint = Record<string, Entry>;

class MissingBlob extends Error {} // Blob answered 404 — logged and skipped, never retried (E33)

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

async function withRetry<T>(fn: () => Promise<T>, tries: number): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof MissingBlob) throw e;
      last = e;
      if (attempt < tries) await sleep(500 * 2 ** attempt);
    }
  }
  throw last;
}

// Full pagination with backoff, so a throttled page can't silently truncate the inventory (E38).
async function listBlobs(): Promise<Item[]> {
  const items: Item[] = [];
  let cursor: string | undefined;
  do {
    const page = await withRetry(() => list({ cursor, limit: 1000 }), 5);
    for (const b of page.blobs) items.push({ key: b.pathname, url: b.url, size: b.size });
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (new Set(items.map((i) => i.key)).size !== items.length) throw new Error("Blob inventory has duplicate keys");
  return items;
}

async function main() {
  const bucket = opt("bucket");
  if (!bucket) throw new Error("--bucket <name> is required (e.g. modusys-staging or modusys)");
  for (const v of ["BLOB_READ_WRITE_TOKEN", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
    if (!process.env[v]) throw new Error(`${v} is not set in the environment`);
  }
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "garage",
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  const runId = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomBytes(2).toString("hex");
  await mkdir(LOCAL_DIR, { recursive: true });

  console.log(`Target: ${process.env.S3_ENDPOINT}  bucket=${bucket}  run=${runId}`);

  // ---- Step 0: reachability pre-flight (§9). Refuse to go on if anything is off (E53).
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  if (!flag("dry-run")) {
    const probe = `${META_PREFIX}_probe-${runId}`;
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: probe, Body: "probe", ContentType: "text/plain" }));
    const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: probe }));
    if ((await got.Body!.transformToString()) !== "probe") throw new Error("Garage probe read-back mismatch");
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: probe }));
    console.log("Pre-flight OK: bucket reachable, probe write/read/delete worked.");
  }

  const blobs = await listBlobs();
  const totalBytes = blobs.reduce((s, b) => s + b.size, 0);
  const byPrefix = new Map<string, { n: number; bytes: number }>();
  for (const b of blobs) {
    const p = b.key.split("/")[0];
    const cur = byPrefix.get(p) ?? { n: 0, bytes: 0 };
    byPrefix.set(p, { n: cur.n + 1, bytes: cur.bytes + b.size });
  }
  console.log(`Blob inventory: ${blobs.length} objects, ${mb(totalBytes)}`);
  for (const [p, v] of byPrefix) console.log(`  ${p}/  ${v.n} objects  ${mb(v.bytes)}`);
  if (flag("dry-run")) return;

  if (flag("verify")) return verify(s3, bucket, blobs);

  // ---- Copy, resumable.
  const cp = await loadCheckpoint(s3, bucket);
  const logPath = `${LOCAL_DIR}/log-${runId}.ndjson`;
  const counts = { copied: 0, skipped: 0, missing: 0, failed: 0 };
  let saving: Promise<void> = Promise.resolve();
  const save = () =>
    (saving = saving.then(async () => {
      const body = JSON.stringify(cp);
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: META_PREFIX + "checkpoint.json", Body: body, ContentType: "application/json" }));
      await writeFile(`${LOCAL_DIR}/checkpoint.json`, body);
    }));
  const log = (event: Record<string, unknown>) => appendFile(logPath, JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");

  async function transfer(it: Item): Promise<string | undefined> {
    const res = await fetch(it.url, { signal: AbortSignal.timeout(Math.max(60_000, it.size / 400)) });
    if (res.status === 404) throw new MissingBlob();
    if (!res.ok) throw new Error(`blob HTTP ${res.status}`);
    // Buffered (files are ≤100 MB): works over plain http tunnels too, where SDK streaming can't sign.
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length !== it.size) throw new Error(`downloaded ${buf.length} bytes, inventory says ${it.size}`);
    const put = await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: it.key,
        Body: buf,
        ContentType: res.headers.get("content-type") ?? "application/octet-stream", // E52
      })
    );
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: it.key }));
    if (head.ContentLength !== it.size) throw new Error(`stored ${head.ContentLength} bytes, expected ${it.size}`);
    return put.ETag;
  }

  async function copyOne(it: Item) {
    const prev = cp[it.key];
    if (prev?.status === "done" && prev.bytes === it.size) {
      // Trust the manifest only if the object is really there at the right size (E51).
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: it.key })).catch(() => null);
      if (head?.ContentLength === it.size) {
        counts.skipped++;
        return;
      }
    }
    const ts = new Date().toISOString();
    try {
      const etag = await withRetry(() => transfer(it), RETRIES);
      cp[it.key] = { bytes: it.size, etag, status: "done", ts };
      counts.copied++;
      await log({ key: it.key, bytes: it.size, status: "done" });
    } catch (e) {
      const missing = e instanceof MissingBlob;
      cp[it.key] = { bytes: it.size, status: missing ? "missing" : "failed", ts, error: missing ? "blob 404" : String((e as Error)?.message ?? e) };
      counts[missing ? "missing" : "failed"]++;
      await log({ key: it.key, status: cp[it.key].status, error: cp[it.key].error });
    }
  }

  let next = 0;
  let finished = 0;
  async function worker() {
    while (next < blobs.length) {
      await copyOne(blobs[next++]);
      finished++;
      if (finished % CHECKPOINT_EVERY === 0) {
        await save();
        console.log(`${finished}/${blobs.length}  copied=${counts.copied} skipped=${counts.skipped} missing=${counts.missing} failed=${counts.failed}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await save();
  const logBody = await readFile(logPath).catch(() => Buffer.from(""));
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `${META_PREFIX}log-${runId}.ndjson`, Body: logBody, ContentType: "application/x-ndjson" }));

  console.log(`Done. copied=${counts.copied} skipped=${counts.skipped} missing=${counts.missing} failed=${counts.failed} of ${blobs.length}`);
  for (const [k, e] of Object.entries(cp)) if (e.status !== "done") console.log(`  ${e.status.toUpperCase()}  ${k}  ${e.error ?? ""}`);
  if (counts.failed || counts.missing) process.exit(1);
}

async function loadCheckpoint(s3: S3Client, bucket: string): Promise<Checkpoint> {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: META_PREFIX + "checkpoint.json" }));
    return JSON.parse(await r.Body!.transformToString()) as Checkpoint;
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return {};
    throw e;
  }
}

// Exact comparison against the Blob inventory — during the freeze there are no "± new writes" (§9.5).
async function verify(s3: S3Client, bucket: string, blobs: Item[]) {
  const have = new Map<string, number>();
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const o of page.Contents ?? []) if (o.Key && !o.Key.startsWith(META_PREFIX)) have.set(o.Key, o.Size ?? 0);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  const want = new Map(blobs.map((b) => [b.key, b.size]));
  const missing = [...want.keys()].filter((k) => !have.has(k));
  const wrongSize = [...want].filter(([k, s]) => have.has(k) && have.get(k) !== s).map(([k]) => k);
  const extra = [...have.keys()].filter((k) => !want.has(k));
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

  console.log(`Blob:   ${want.size} objects, ${sum(want)} bytes`);
  console.log(`Garage: ${have.size} objects, ${sum(have)} bytes (excluding ${META_PREFIX})`);
  console.log(`missing=${missing.length} wrongSize=${wrongSize.length} extra=${extra.length}`);
  for (const k of missing.slice(0, 20)) console.log(`  MISSING    ${k}`);
  for (const k of wrongSize.slice(0, 20)) console.log(`  WRONG SIZE ${k}`);
  for (const k of extra.slice(0, 20)) console.log(`  EXTRA      ${k}`);
  const ok = !missing.length && !wrongSize.length && (flag("allow-extra") || !extra.length);
  console.log(ok ? "VERIFY OK" : "VERIFY FAILED");
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
