// The session token lives only in the iOS Keychain / Android Keystore.
// Never AsyncStorage, never logged.
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.modusys.app.session';

export async function saveToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('session', token, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function loadToken(): Promise<string | null> {
  const found = await Keychain.getGenericPassword({ service: SERVICE });
  return found ? found.password : null;
}

export async function clearToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
