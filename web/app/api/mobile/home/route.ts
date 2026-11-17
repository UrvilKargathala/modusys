import { NextResponse } from "next/server";
import { requireRole } from "@backend/server/require-user";
import { homeSummary } from "@backend/server/mobile-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phone admin Home tiles (read-only). Admin and super admin, the roles that see Quotes.
export async function GET() {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;
  return NextResponse.json(await homeSummary(auth.user));
}
