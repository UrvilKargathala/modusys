// Open a stored file (chat PDF, gallery video / document) in the phone's own viewer: ask the server for a 2-minute link
// (the viewer can't send our login header), then hand it to the system.
import { Linking } from 'react-native';
import { fileLink } from '../api/media';

export async function openFile(ref: { message: string } | { media: string }): Promise<void> {
  try {
    await Linking.openURL(await fileLink(ref));
  } catch {
    // Nothing to show here: the tile stays as it is (no viewer, or the link failed).
  }
}
