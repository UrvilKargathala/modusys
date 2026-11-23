import { NextResponse } from "next/server";
import { requireUser } from "@backend/server/require-user";
import { liveNotifications } from "@backend/server/live-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The website bell's live items for the signed-in user (read-only). Their read state stays on the phone, as the
// website keeps it in each browser.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  return NextResponse.json(await liveNotifications(auth.user.id));
}
