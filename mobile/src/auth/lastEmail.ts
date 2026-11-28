// The email last used to sign in, so Sign In can fill it in after a sign-out. Only the email (not secret);
// the password and the session token never go to AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'modusys.lastEmail';

export async function loadLastEmail(): Promise<string> {
  return (await AsyncStorage.getItem(KEY).catch(() => null)) ?? '';
}

export async function saveLastEmail(email: string): Promise<void> {
  await AsyncStorage.setItem(KEY, email).catch(() => undefined);
}
