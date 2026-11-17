import { NextResponse } from "next/server";
import { requireRole } from "@backend/server/require-user";
import { customerQuoteSummaries } from "@backend/server/mobile-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One customer's quotes for the phone's customer Overview (read-only, ?customerId= required). Admin and super admin, the roles
// that see Quotes on the web; the Quotes list itself is web-only.
export async function GET(req: Request) {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;
  const customerId = new URL(req.url).searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  return NextResponse.json(await customerQuoteSummaries(customerId));
}
