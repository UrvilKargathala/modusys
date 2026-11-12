import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rate-limit";
import { reportError } from "@/lib/server/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Receives browser errors from lib/report-client-error.ts. Open without sign-in
// (errors can happen on the sign-in page), so it is rate-limited per IP and
// every field is capped.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!rateLimit(`client-errors:${ip}`, 20, 60_000).ok) return new NextResponse(null, { status: 429 });

  const text = await req.text();
  if (text.length > 20_000) return new NextResponse(null, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  await reportError({
    source: "browser",
    message: str(body.message, 1000),
    stack: str(body.stack, 8000),
    code: str(body.code, 32)?.replace(/[^a-z0-9]/gi, ""),
    path: str(body.path, 500),
    routeType: "browser",
    headers: req.headers,
  });
  return new NextResponse(null, { status: 204 });
}
