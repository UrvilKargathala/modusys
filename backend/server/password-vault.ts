import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Reversible copy of a user's password so the super-admin can view it.
// Key: PASSWORD_VIEW_KEY if set, otherwise derived from SESSION_SECRET.
function key(): Buffer {
  const secret = process.env.PASSWORD_VIEW_KEY || process.env.SESSION_SECRET;
  if (!secret) throw new Error("PASSWORD_VIEW_KEY or SESSION_SECRET must be set");
  return createHash("sha256").update(`modusys-password-view:${secret}`).digest();
}

// Format: v1.<iv>.<tag>.<ciphertext>, all base64url.
export function encryptPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptPassword(stored: string): string | null {
  try {
    const [v, iv, tag, data] = stored.split(".");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
