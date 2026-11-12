// Self-check for lib/error-fingerprint.ts. Run: npx tsx scripts/check-error-fingerprint.ts
import assert from "node:assert/strict";
import { fingerprintOf, frameName, stripPrismaArgs } from "../lib/error-fingerprint";

// Frame names: V8 (minified chunk, source-mapped, async), no-name frames, Safari/Firefox.
assert.equal(frameName("Error: x\n    at g (.next/server/chunks/[root]__18-lihc._.js:1:1168)"), "g");
assert.equal(frameName("Error: x\n    at g (app/api/quotes/route.ts:5:9)"), "g");
assert.equal(frameName("Error: x\n    at async Module.POST (app/api/a/route.ts:3:1)"), "Module.POST");
assert.equal(frameName("Error: x\n    at /app/.next/server/chunk.js:1:2"), "");
assert.equal(frameName("onClick@https://modusys.co.in/_next/static/chunks/0a1b2c.js:1:99"), "onClick");
assert.equal(frameName("@https://modusys.co.in/_next/static/chunks/0a1b2c.js:1:99"), "");
// An email in the message line is not a Safari frame.
assert.equal(frameName("Error: no user a@b.com\n    at find (lib/x.ts:1:1)"), "find");
assert.equal(frameName(undefined), "");

// Same bug across deploys (new chunk hash, new line numbers, different ids) → same group.
const a = fingerprintOf("server", "Quote 123 not found (id cms32j3ap00005sycap1)", "Error\n    at g (.next/server/chunks/aaa111._.js:1:10)");
const b = fingerprintOf("server", "Quote 456 not found (id cms99zzzp00007abcdef2)", "Error\n    at g (.next/server/chunks/bbb222._.js:7:42)");
assert.equal(a, b);
// Different function, message or source → different group.
assert.notEqual(a, fingerprintOf("server", "Quote 123 not found", "Error\n    at h (x.js:1:1)"));
assert.notEqual(a, fingerprintOf("browser", "Quote 123 not found (id cms32j3ap00005sycap1)", "Error\n    at g (x.js:1:1)"));

// Prisma messages lose the query arguments (customer data), keep the reason.
const prismaMsg = "\nInvalid `prisma.customer.create()` invocation:\n\n{\n  data: {\n    name: \"Rahul Sharma\",\n    mobile: 9876543210\n  }\n}\n\nArgument `mobile`: Invalid value provided. Expected String, provided Int.";
const cleaned = stripPrismaArgs(prismaMsg, `PrismaClientValidationError: ${prismaMsg}\n    at Gn (node_modules/x.js:1:1)\n    at POST (app/api/customers/route.ts:40:5)`);
assert.equal(cleaned.message, "Argument `mobile`: Invalid value provided. Expected String, provided Int.");
assert.ok(!cleaned.stack!.includes("Rahul") && !cleaned.stack!.includes("9876543210"));
assert.ok(cleaned.stack!.includes("at POST (app/api/customers/route.ts:40:5)"));
assert.deepEqual(stripPrismaArgs("plain error", "s"), { message: "plain error", stack: "s" });

console.log("error-fingerprint: all checks passed");
