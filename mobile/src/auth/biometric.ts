// Sign in with Face ID / Touch ID / fingerprint. After a password sign-in the user can choose to keep their email and
// password in the iOS Keychain / Android Keystore, locked behind the phone's biometrics: reading them back needs a
// fresh face or finger, and enrolling a new face or finger on the phone wipes them (BIOMETRY_CURRENT_SET).
// Kept after sign-out on purpose (that is when it's needed); cleared when the password stops working.
import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';

const SERVICE = 'com.modusys.app.biometric-login';

export type Biometry = { label: string } | null;

/** What the phone offers ("Face ID", "Touch ID", "fingerprint"), or null when none is set up. */
export async function getBiometry(): Promise<Biometry> {
  const type = await Keychain.getSupportedBiometryType().catch(() => null);
  if (!type) return null;
  if (type === Keychain.BIOMETRY_TYPE.FACE_ID) return { label: 'Face ID' };
  if (type === Keychain.BIOMETRY_TYPE.TOUCH_ID) return { label: 'Touch ID' };
  if (type === Keychain.BIOMETRY_TYPE.FACE || type === Keychain.BIOMETRY_TYPE.IRIS) return { label: Platform.OS === 'ios' ? 'Face ID' : 'face unlock' };
  return { label: 'fingerprint' };
}

/** Is a biometric sign-in saved? Doesn't ask for a face or finger. */
export async function hasBiometricLogin(): Promise<boolean> {
  return Keychain.hasGenericPassword({ service: SERVICE }).catch(() => false);
}

export async function saveBiometricLogin(email: string, password: string): Promise<boolean> {
  const done = await Keychain.setGenericPassword(email, password, {
    service: SERVICE,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
    accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
  }).catch(() => false);
  return !!done;
}

/** Asks for the face or finger; null when the user cancels or it fails. */
export async function loadBiometricLogin(): Promise<{ email: string; password: string } | null> {
  try {
    const found = await Keychain.getGenericPassword({
      service: SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      authenticationPrompt: { title: 'Sign in to Modusys', cancel: 'Use password' },
    });
    return found ? { email: found.username, password: found.password } : null;
  } catch {
    return null;
  }
}

export async function clearBiometricLogin(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE }).catch(() => undefined);
}
