// Voice notes for the customer chat: record (with the microphone permission), and play a note from the server.
// One shared recorder / player, like the website's single MediaRecorder; react-native-nitro-sound does the audio.
import { PermissionsAndroid, Platform } from 'react-native';
import Sound, { AudioEncoderAndroidType, AudioSourceAndroidType, AVEncoderAudioQualityIOSType, type AudioSet, type RecordBackType } from 'react-native-nitro-sound';

/** Android asks at the moment of recording; iOS asks by itself the first time (Info.plist text). */
async function micAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone',
    message: 'Modusys needs the microphone to record a voice note for this customer.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

/** Spoken-voice quality: mono AAC, small files (about 0.5 MB a minute). */
const VOICE: AudioSet = {
  AudioSamplingRate: 44100,
  AudioEncodingBitRate: 64000,
  AudioChannels: 1,
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AudioSourceAndroid: AudioSourceAndroidType.MIC,
  AVFormatIDKeyIOS: 'aac',
  AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.medium,
  AVNumberOfChannelsKeyIOS: 1,
};

/** Starts recording; `onTick` gets the seconds so far. Resolves false when the microphone isn't allowed. */
export async function startVoice(onTick: (seconds: number) => void): Promise<boolean> {
  if (!(await micAllowed())) return false;
  await stopPlaying();
  Sound.addRecordBackListener((e: RecordBackType) => onTick(Math.floor(e.currentPosition / 1000)));
  try {
    await Sound.startRecorder(undefined, VOICE);
    return true;
  } catch {
    Sound.removeRecordBackListener();
    return false;
  }
}

/** Stops recording and returns the file (file:// address). */
export async function stopVoice(): Promise<string> {
  const uri = await Sound.stopRecorder();
  Sound.removeRecordBackListener();
  return uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`;
}

let playingId: string | null = null;
let onPlayChange: ((id: string | null) => void) | null = null;

/** Plays a voice note; `getUrl` fetches its short-lived link. A second call with the same id stops it. */
export async function togglePlay(id: string, getUrl: () => Promise<string>, onChange: (id: string | null) => void) {
  const same = playingId === id;
  await stopPlaying();
  if (same) return;
  onPlayChange = onChange;
  playingId = id;
  onChange(id);
  Sound.addPlaybackEndListener(() => {
    stopPlaying().catch(() => undefined);
  });
  try {
    const url = await getUrl();
    if (playingId !== id) return; // stopped or switched while the link was loading
    await Sound.startPlayer(url);
  } catch (e) {
    if (__DEV__) console.warn('voice note did not play', e);
    await stopPlaying();
  }
}

export async function stopPlaying() {
  if (!playingId) return;
  playingId = null;
  onPlayChange?.(null);
  onPlayChange = null;
  Sound.removePlaybackEndListener();
  await Sound.stopPlayer().catch(() => undefined);
}
