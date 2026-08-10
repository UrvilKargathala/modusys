import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/require-user";
import { logAudit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Talks to the UniFi CloudKey on the office LAN. Self-signed TLS cert on the
// controller, so this endpoint depends on NODE_TLS_REJECT_UNAUTHORIZED=0
// being set for the process (matches lib/unifi.ts).
//
// Only reachable when the caller's server can hit UNIFI_HOST — in practice
// the office LAN. Returns a friendly "must be on office network" message on
// timeout / network error rather than a stack trace.

const CLOUDKEY_TIMEOUT_MS = 10_000;

type WebhookEndpoint = { id: string; endpoint: string; name?: string; events?: string[] };

async function ck(path: string, init: RequestInit = {}) {
  const host = process.env.UNIFI_HOST;
  const token = process.env.UNIFI_API_TOKEN;
  if (!host) throw new Error("UNIFI_HOST is not configured");
  if (!token) throw new Error("UNIFI_API_TOKEN is not configured");
  return fetch(`${host}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(CLOUDKEY_TIMEOUT_MS),
  });
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ETIMEDOUT|ENOTFOUND|ECONNREFUSED|network|fetch failed|timeout/i.test(msg)) {
    return "Cannot reach UniFi CloudKey. Must be on office network to reset webhook.";
  }
  return msg;
}

function targetEndpointUrl(req: Request) {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  const base = explicit && explicit.trim() ? explicit.replace(/\/+$/, "") : new URL(req.url).origin;
  return `${base}/api/webhooks/unifi-access`;
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "super-admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const secret = process.env.UNIFI_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: "UNIFI_WEBHOOK_SECRET is not configured" },
      { status: 500 }
    );
  }

  const endpoint = targetEndpointUrl(req);

  try {
    // 1. List existing endpoints
    const listRes = await ck("/api/v1/developer/webhooks/endpoints");
    if (listRes.status === 401 || listRes.status === 403) {
      return NextResponse.json(
        { success: false, error: "UniFi API token rejected. Check UNIFI_API_TOKEN." },
        { status: 502 }
      );
    }
    if (!listRes.ok) {
      return NextResponse.json(
        { success: false, error: `CloudKey returned ${listRes.status} listing webhooks` },
        { status: 502 }
      );
    }
    const listJson = await listRes.json().catch(() => ({}));
    // Different UniFi builds shape this as { data: [...] } or a bare array.
    const items: WebhookEndpoint[] = Array.isArray(listJson)
      ? listJson
      : Array.isArray(listJson?.data)
        ? listJson.data
        : Array.isArray(listJson?.data?.endpoints)
          ? listJson.data.endpoints
          : [];

    // 2. Delete every endpoint whose URL matches ours (defensive — handles the
    // case where old duplicates piled up while the webhook was silently broken).
    const matches = items.filter((it) => it?.endpoint && it.endpoint.replace(/\/+$/, "") === endpoint);
    for (const it of matches) {
      const delRes = await ck(`/api/v1/developer/webhooks/endpoints/${it.id}`, { method: "DELETE" });
      if (!delRes.ok && delRes.status !== 404) {
        return NextResponse.json(
          { success: false, error: `CloudKey returned ${delRes.status} deleting webhook ${it.id}` },
          { status: 502 }
        );
      }
    }

    // 3. Create a fresh one.
    const createRes = await ck("/api/v1/developer/webhooks/endpoints", {
      method: "POST",
      body: JSON.stringify({
        endpoint,
        name: "Modusys-Production",
        events: ["access.door.unlock"],
        headers: { "X-Webhook-Secret": secret },
      }),
    });
    if (!createRes.ok) {
      return NextResponse.json(
        { success: false, error: `CloudKey returned ${createRes.status} creating webhook` },
        { status: 502 }
      );
    }
    const createJson = await createRes.json().catch(() => ({}));
    const newWebhookId = createJson?.data?.id ?? createJson?.id ?? null;

    void logAudit({
      action: "UNIFI_WEBHOOK_RESET",
      actor: { id: me.id, email: me.email, name: me.name },
      target: { type: "INTEGRATION", id: "unifi-webhook", label: "UniFi Access — Webhook Reset" },
      details: { endpoint, deleted: matches.length, newWebhookId },
      req,
    });

    return NextResponse.json({
      success: true,
      newWebhookId,
      deleted: matches.length,
      endpoint,
      message: "Webhook reset successfully",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: friendlyError(e) },
      { status: 502 }
    );
  }
}
