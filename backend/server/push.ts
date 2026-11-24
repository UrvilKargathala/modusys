import "server-only";
import type { App } from "firebase-admin/app";
import { prisma } from "./prisma";

// Phone push notifications (M6e, 24/11/2026). Whenever the server stores a bell notification for someone, it also
// sends it to their phones through Firebase Cloud Messaging, so it pops up even with the app closed. The sending key
// is the env var FIREBASE_SERVICE_ACCOUNT (the service account JSON on one line); without it nothing is sent and the
// website works as before. Sending never blocks or fails the request that created the notification.

export type PushItem = { userId: string; type: string; message: string; relatedTaskId?: string | null };

let app: App | null | undefined;

async function firebase(): Promise<App | null> {
  if (app !== undefined) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return (app = null);
  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(raw)) });
  } catch (e) {
    console.error("[push] FIREBASE_SERVICE_ACCOUNT could not be read", e instanceof Error ? e.message : e);
    app = null;
  }
  return app;
}

/** Push title per notification type, matching the bell's wording on the phone. */
function titleFor(type: string): string {
  switch (type) {
    case "assigned":
      return "New task";
    case "completed":
      return "Task completed";
    case "mentioned":
      return "You were mentioned";
    case "leave-requested":
      return "Leave request";
    case "leave-approved":
      return "Leave approved";
    case "leave-rejected":
      return "Leave rejected";
    case "attendance-correction":
      return "Attendance fix request";
    default:
      return "Modusys";
  }
}

// Firebase error codes that mean the token will never work again.
const DEAD = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"]);

async function send(items: PushItem[]) {
  const fb = await firebase();
  if (!fb || items.length === 0) return;
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: [...new Set(items.map((i) => i.userId))] } },
    select: { token: true, userId: true },
  });
  if (tokens.length === 0) return;
  const { getMessaging } = await import("firebase-admin/messaging");
  const messages = items.flatMap((item) =>
    tokens
      .filter((t) => t.userId === item.userId)
      .map((t) => ({
        token: t.token,
        notification: { title: titleFor(item.type), body: item.message },
        // What the phone needs to open the same screen as tapping the bell item.
        data: { type: item.type, relatedTaskId: item.relatedTaskId ?? "" },
        android: { priority: "high" as const },
      })),
  );
  const dead: string[] = [];
  // sendEach takes up to 500 messages per call.
  for (let i = 0; i < messages.length; i += 500) {
    const batch = messages.slice(i, i + 500);
    const res = await getMessaging(fb).sendEach(batch);
    res.responses.forEach((r, j) => {
      if (!r.success && r.error && DEAD.has(r.error.code)) dead.push(batch[j].token);
      else if (!r.success) console.error("[push] send failed", r.error?.code);
    });
  }
  if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
}

/** Send stored notifications to the users' phones. Fire and forget: errors are logged, never thrown. */
export function pushToUsers(items: PushItem[]): void {
  void send(items).catch((e) => console.error("[push]", e instanceof Error ? e.message : e));
}

/** Save this phone's token for the signed-in user (moves it over if another user had it). */
export async function savePushToken(userId: string, token: string, platform: string) {
  await prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform, lastSeenAt: new Date() },
  });
}

/** Forget this phone's token (sign-out). Only the user's own token. */
export async function removePushToken(userId: string, token: string) {
  await prisma.pushToken.deleteMany({ where: { token, userId } });
}
