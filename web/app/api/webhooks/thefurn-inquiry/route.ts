import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reportRouteError } from "@backend/server/report-error";
import { rateLimit } from "@backend/server/rate-limit";
import { ingestTheFurnInquiry, verifyTheFurnSignature } from "@backend/server/website-inquiry";

export const dynamic = "force-dynamic";

// THE FURN website → Modusys Tickets (stage "Website Inquiry"). Server-to-server
// only, HMAC-signed; the work is in backend/server/website-inquiry.ts.
const s = (max: number) => z.string().trim().max(max).default("");
const Body = z.object({
  externalId: z.string().trim().min(8).max(100),
  submittedAt: z.string().datetime(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  email: s(160),
  state: s(80),
  city: s(120),
  inquiryType: s(60),
  budgetLabel: s(80),
  tier: s(40),
  message: s(3000),
  pageUrl: s(300),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit(`thefurn-inquiry:${ip}`, 60, 60_000).ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const raw = await req.text();
    if (raw.length > 20_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    if (!verifyTheFurnSignature(raw, req.headers.get("x-thefurn-timestamp"), req.headers.get("x-thefurn-signature"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let json: unknown;
    try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const parsed = Body.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 422 });

    const result = await ingestTheFurnInquiry(parsed.data, json);
    return NextResponse.json({ ok: true, ...result }, { status: result.outcome === "created" ? 201 : 200 });
  } catch (err) {
    const code = await reportRouteError(req, err);
    return NextResponse.json({ error: "Internal server error", code }, { status: 500 });
  }
}
