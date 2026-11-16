// Phone hardware for check-in/out: GPS position and the front-camera selfie.
// Screens call these instead of the native modules directly.
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';

// Location only at the moment of check-in/out: never in the background.
Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: 'auto',
});

export type Position = { latitude: number; longitude: number; accuracy: number };
export type LocationResult =
  | { ok: true; position: Position }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' };

async function androidPermission(): Promise<boolean> {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
    title: 'Location for attendance',
    message: 'Modusys records where you are when you check in or out.',
    buttonPositive: 'Allow',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function fix(highAccuracy: boolean, timeout: number, maximumAge: number): Promise<LocationResult> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          position: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy },
        }),
      (err) =>
        resolve({ ok: false, reason: err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: highAccuracy, timeout, maximumAge },
    );
  });
}

/**
 * One position. Asks for permission the first time (iOS asks on the first request).
 * Tries GPS first; indoors GPS often can't get a fix, so it falls back to
 * Wi-Fi / mobile network location, which is what a browser does on the web.
 */
export async function getLocation(): Promise<LocationResult> {
  if (Platform.OS === 'android' && !(await androidPermission())) return { ok: false, reason: 'denied' };
  const gps = await fix(true, 10_000, 30_000);
  if (gps.ok || gps.reason === 'denied') return gps;
  return fix(false, 15_000, 5 * 60_000);
}

export const MAX_SELFIE_BYTES = 500 * 1024; // the server's limit

export type SelfieResult =
  | { ok: true; photo: Asset & { uri: string } }
  | { ok: false; reason: 'cancelled' | 'no-camera' | 'denied' | 'too-big' | 'failed' };

// 480×640 JPEG like the web's selfie, comfortably under the 500 KB limit.
const photoOptions = { mediaType: 'photo', maxWidth: 480, maxHeight: 640, quality: 0.7, includeBase64: false } as const;

/** Opens the phone's camera (front camera where the phone allows it). */
export async function takeSelfie(): Promise<SelfieResult> {
  const res = await launchCamera({ ...photoOptions, cameraType: 'front', saveToPhotos: false });
  return toResult(res.didCancel, res.errorCode, res.assets?.[0]);
}

/** Development only: simulators have no camera, so pick a saved photo instead. */
export async function pickTestPhoto(): Promise<SelfieResult> {
  const res = await launchImageLibrary({ ...photoOptions, selectionLimit: 1 });
  return toResult(res.didCancel, res.errorCode, res.assets?.[0]);
}

function toResult(cancelled?: boolean, errorCode?: string, asset?: Asset): SelfieResult {
  if (cancelled) return { ok: false, reason: 'cancelled' };
  if (errorCode === 'camera_unavailable') return { ok: false, reason: 'no-camera' };
  if (errorCode === 'permission') return { ok: false, reason: 'denied' };
  if (!asset?.uri) return { ok: false, reason: 'failed' };
  if (asset.fileSize && asset.fileSize > MAX_SELFIE_BYTES) return { ok: false, reason: 'too-big' };
  return { ok: true, photo: { ...asset, uri: asset.uri } };
}
