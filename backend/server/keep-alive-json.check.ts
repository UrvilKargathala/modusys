// Run: npx tsx backend/server/keep-alive-json.check.ts   (free)
import assert from "node:assert/strict";

// Keep-alive stream: spaces while working, then JSON that still parses.
import { keepAliveJson } from "./keep-alive-json";
void (async () => {
  const res = keepAliveJson(() => new Promise((r) => setTimeout(() => r({ ok: 1 }), 70)), 20);
  const text = await res.text();
  assert.ok(text.startsWith("  "), "spaces sent while waiting");
  assert.deepEqual(JSON.parse(text), { ok: 1 });
  assert.equal(res.headers.get("cache-control"), "no-store, no-transform");
  console.log("keep-alive ok");
})();
