import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/server/prisma";

// Sole owner of the S3 SDK (Blob → Garage migration, §8.1 of the migration doc).
// Clients are built lazily so importing this module never needs S3_* at build time.
function makeClient(endpoint: string | undefined) {
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? "garage",
    forcePathStyle: true,
    // Newer SDKs add a CRC32 checksum by default. For a presigned PUT that means the checksum of an
    // EMPTY body gets baked into the URL, so Garage rejects every real upload with InvalidDigest
    // (found in the staging test). Only send checksums when the server actually requires them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

let _s3: S3Client | undefined;
let _signer: S3Client | undefined;
// Server ops (app → Garage) may use a loopback/LAN endpoint.
const s3 = () => (_s3 ??= makeClient(process.env.S3_ENDPOINT));
// Presigned PUTs are used by browsers, so the signed host must be the public one (§8.3, E45).
const signer = () =>
  (_signer ??= makeClient(process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT));
const bucket = () => process.env.S3_BUCKET!;

// Server-side key minting: timestamp + randomness + sanitized name. Never trust client keys (E1, E6).
export function newKey(prefix: string, owner: string, origName: string) {
  const safe = origName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "file";
  return `${prefix}/${owner}/${Date.now()}-${randomBytes(4).toString("hex")}-${safe}`;
}

// Client must send the exact Content-Type and Content-Length it was minted for.
// The SDK does not sign content-type by default, which would let a client upload a different
// type than the one validated at presign time — signableHeaders pins it (E4).
export const presignPut = (Key: string, ContentType: string, size: number) =>
  getSignedUrl(
    signer(),
    new PutObjectCommand({ Bucket: bucket(), Key, ContentType, ContentLength: size }),
    {
      expiresIn: Number(process.env.S3_PUT_EXPIRY ?? 120),
      signableHeaders: new Set(["content-type"]),
    },
  );

export const getObject = (Key: string, Range?: string) =>
  s3().send(new GetObjectCommand({ Bucket: bucket(), Key, Range }));

export const headObject = (Key: string) =>
  s3().send(new HeadObjectCommand({ Bucket: bucket(), Key }));

export const putServerFile = (Key: string, Body: Buffer, ContentType: string) =>
  s3().send(new PutObjectCommand({ Bucket: bucket(), Key, Body, ContentType }));

export const deleteKey = (Key: string) =>
  s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key }));

// Refcount-guarded delete for shared chat objects (§8.4): forwarded messages share one object.
// Call AFTER the row is deleted/updated (row first, count second). Returns true if deleted.
export async function deleteKeyIfUnreferenced(Key: string) {
  const refs = await prisma.message.count({
    where: { OR: [{ imageKeys: { has: Key } }, { audioKey: Key }, { pdfKey: Key }] },
  });
  if (refs > 0) return false;
  try {
    await deleteKey(Key);
    return true;
  } catch (e) {
    console.warn("[storage] deleteKey failed", e);
    return false;
  }
}
