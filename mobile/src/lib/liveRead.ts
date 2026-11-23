// Read state of the website bell's live items on this phone (decided 21/11/2026): the website keeps it in each
// browser, so the phone keeps its own. Not secret, so AsyncStorage (the session token stays in the Keychain).
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: string) => `live-read:${userId}`;
const KEEP = 500; // live items drop out after a few days; keep the newest ids only

export async function loadLiveRead(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function saveLiveRead(userId: string, ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify([...ids].slice(-KEEP)));
}
