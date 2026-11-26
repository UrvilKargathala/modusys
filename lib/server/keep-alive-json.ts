// Cloudflare (in front of modusys.co.in) answers 524 when the origin sends nothing for 100 s, and a drawing read
// takes up to 5 min. So answer 200 at once, send a space every `everyMs` while working (JSON allows leading
// whitespace), then the JSON. Errors therefore arrive as `{ error }` in a 200 body. "no-transform" stops gzip
// from holding the spaces back.
export function keepAliveJson(work: () => Promise<unknown>, everyMs = 15_000) {
  const enc = new TextEncoder();
  let tick: ReturnType<typeof setInterval> | undefined;
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      // enqueue throws once the browser has gone away; never let that escape a timer.
      const send = (s: string) => { try { c.enqueue(enc.encode(s)); } catch {} };
      tick = setInterval(() => send(" "), everyMs);
      try {
        send(JSON.stringify(await work()));
      } finally {
        clearInterval(tick);
        try { c.close(); } catch {}
      }
    },
    cancel() { clearInterval(tick); },
  });
  return new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-transform" } });
}
