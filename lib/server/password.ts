import "server-only";
import bcrypt from "bcryptjs";

// bcryptjs (pure JS, no native bindings) — safer than native `bcrypt` on
// Vercel's serverless runtime, same algorithm/output format.
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
