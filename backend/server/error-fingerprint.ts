import { createHash } from "crypto";

// Pure helpers for lib/server/report-error.ts (no server-only import, so
// scripts/check-error-fingerprint.ts can test them with plain tsx).

// Same bug → same fingerprint, across deploys: ids and numbers in the message
// are blanked, and of the first stack frame only the function name is kept
// (file paths, URLs and line numbers change with every build). Handles V8
// "at fn (url:1:2)" and Safari/Firefox "fn@url:1:2" frames.
export function frameName(stack?: string): string {
  const lines = stack?.split("\n").map((l) => l.trim()) ?? [];
  const v8 = lines.find((l) => l.startsWith("at "));
  if (v8) {
    const f = v8.slice(3).replace(/^async /, "");
    return f.includes(" (") ? f.slice(0, f.indexOf(" (")) : ""; // "at file.js:1:2" has no name
  }
  const other = lines.find((l) => /^\S*@/.test(l)); // "fn@url"; a message line has spaces before any @
  return other ? other.slice(0, other.indexOf("@")) : "";
}

export function fingerprintOf(source: string, message: string, stack?: string): string {
  // Ids: any 8+ character token with a digit in it (cuids, uuids, hex hashes, phone numbers).
  const msg = message.replace(/\b(?=[\w-]*\d)[\w-]{8,}\b/g, "<id>").replace(/\d+/g, "#");
  return createHash("sha1").update(`${source}|${msg}|${frameName(stack)}`).digest("hex").slice(0, 16);
}

// Prisma's "Invalid `prisma.x.create()` invocation" messages print the query
// arguments (customer names, phone numbers…). Keep only the last line, which
// says what was wrong without the values.
export function stripPrismaArgs(message: string, stack?: string): { message: string; stack?: string } {
  if (!message.includes("Invalid `prisma.")) return { message, stack };
  const last = message.trim().split("\n").pop()?.trim() || "Invalid Prisma call";
  const frames = stack?.split("\n").filter((l) => /^\s+at /.test(l)) ?? [];
  return { message: last, stack: [`PrismaError: ${last}`, ...frames].join("\n") };
}
