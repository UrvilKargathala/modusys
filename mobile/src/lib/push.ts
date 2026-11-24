// Push notifications (M6e, 24/11/2026), Android only for now: iPhone push needs an Apple developer account, so Firebase
// is left out of the iOS build (react-native.config.js) and nothing here touches it on iOS.
//
// After sign-in the phone asks Firebase for its token and gives it to the server, which then pushes every new bell
// notification to it (backend/server/push.ts). Signing out removes the token. Pushes show in the phone's notification
// shade by themselves when the app is closed or in the background; tapping one opens the bell list.
import { PermissionsAndroid, Platform } from 'react-native';
import type { Messaging, RemoteMessage } from '@react-native-firebase/messaging';
import { registerPushToken, unregisterPushToken } from '../api/push';

export const pushOn = Platform.OS === 'android';

type FirebaseMessaging = typeof import('@react-native-firebase/messaging');

// Loaded only on Android, so the iOS build (which has no Firebase native code) never imports it.
function fm(): { lib: FirebaseMessaging; m: Messaging } | null {
  if (!pushOn) return null;
  const lib = require('@react-native-firebase/messaging') as FirebaseMessaging;
  return { lib, m: lib.getMessaging() };
}

/** Android 13+ asks once for permission to show notifications; older Android (the OPPO is 11) allows it already. */
async function askPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Start push for the signed-in user. `onOpen` runs when a push is tapped (also when the tap started the app);
 * `onArrive` runs when one arrives while the app is open (no banner then: the bell updates instead).
 * Returns a function that stops listening.
 */
export function startPush(onOpen: (msg: RemoteMessage) => void, onArrive: (msg: RemoteMessage) => void): () => void {
  const f = fm();
  if (!f) return () => undefined;
  const { lib, m } = f;
  let stopped = false;
  (async () => {
    if (!(await askPermission())) return;
    const token = await lib.getToken(m);
    if (!stopped) await registerPushToken(token, 'android');
    const initial = await lib.getInitialNotification(m);
    if (initial && !stopped) onOpen(initial);
  })().catch(() => undefined);
  const offRefresh = lib.onTokenRefresh(m, (token) => {
    registerPushToken(token, 'android').catch(() => undefined);
  });
  const offOpened = lib.onNotificationOpenedApp(m, onOpen);
  const offMessage = lib.onMessage(m, onArrive);
  return () => {
    stopped = true;
    offRefresh();
    offOpened();
    offMessage();
  };
}

/**
 * Sign-out: tell the server to stop (when the session is still valid), then drop the token on the phone so it can't
 * get the old user's pushes even if the server call failed.
 */
export async function stopPush(tellServer: boolean): Promise<void> {
  const f = fm();
  if (!f) return;
  const { lib, m } = f;
  try {
    if (tellServer) await unregisterPushToken(await lib.getToken(m));
  } catch {
    // Signed out anyway; the token is deleted below and the server drops dead tokens on its next send.
  }
  await lib.deleteToken(m).catch(() => undefined);
}

/** Pushes that arrive while the app is in the background are shown by Android; nothing to do here. */
export function setBackgroundHandler() {
  const f = fm();
  if (f) f.lib.setBackgroundMessageHandler(f.m, async () => undefined);
}
