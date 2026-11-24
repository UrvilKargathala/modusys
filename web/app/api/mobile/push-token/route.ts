import { NextResponse } from "next/server";
import { requireUser } from "@backend/server/require-user";
import { removePushToken, savePushToken } from "@backend/server/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(req: Request): Promise<{ token: string; platform: string } | null> {
  const body = (await req.json().catch(() => null)) as { token?: unknown; platform?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const platform = body?.platform === "ios" ? "ios" : "android";
  if (!token || token.length > 4096) return null;
  return { token, platform };
}

// POST /api/mobile/push-token { token, platform } → this phone gets the signed-in user's notifications as push (M6e).
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  await savePushToken(auth.user.id, body.token, body.platform);
  return NextResponse.json({ ok: true });
}

// DELETE /api/mobile/push-token { token } → sign-out: stop pushing to this phone.
export async function DELETE(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  await removePushToken(auth.user.id, body.token);
  return NextResponse.json({ ok: true });
}
