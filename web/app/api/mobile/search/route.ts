import { NextResponse } from "next/server";
import { requireUser } from "@backend/server/require-user";
import { mobileSearch } from "@backend/server/mobile-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The phone's search (?q=): the website's Ctrl/Cmd+K matches. Quotes only for admin and super admin.
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json(await mobileSearch(q, auth.user.role === "super-admin" || auth.user.role === "admin"));
}
