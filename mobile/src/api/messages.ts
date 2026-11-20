// A customer's notes: the web calls them the customer chat (CRM customer panel).
// Same endpoints: list, send a text note, and mark everything read on opening.
import { api } from './client';
import { uploadFile, type LocalFile } from './upload';

export type MessageKind = 'chat' | 'system' | 'voice' | 'image' | 'pdf';

/** As /api/customers/[id]/messages sends it (backend/server/serialize.ts serializeMessage). */
export type Message = {
  id: string;
  customerId: string;
  kind: MessageKind;
  /** null for system messages (stage changes). */
  senderId: string | null;
  text?: string;
  /** Login-gated /api/files/... addresses; load with imageSource(). */
  imageUrls: string[];
  audioUrl?: string;
  durationSec?: number;
  pdfUrl?: string;
  pdfName?: string;
  isForwarded: boolean;
  reactions: { emoji: string; count: number; reactedByMe: boolean }[];
  editedAt?: string;
  createdAt: string;
};

export function listMessages(customerId: string) {
  return api<Message[]>(`/api/customers/${encodeURIComponent(customerId)}/messages`);
}

const thread = (customerId: string) => `/api/customers/${encodeURIComponent(customerId)}/messages`;

/**
 * A text message. `mentionedUserIds` are the people picked with @ (the text holds "@Name"); as on the website, the
 * server gives each of them a follow-up task and a bell notification.
 */
export function sendNote(customerId: string, text: string, mentionedUserIds: string[] = []) {
  return api<Message>(thread(customerId), { body: { kind: 'chat', text, mentionedUserIds } });
}

/** Photos as one message, with the typed text as the caption (the website's image group). */
export async function sendImages(customerId: string, files: LocalFile[], caption: string) {
  const imageKeys = await Promise.all(files.map((f) => uploadFile(`${thread(customerId)}/presign`, f)));
  return api<Message>(thread(customerId), { body: { kind: 'image', imageKeys, imageNames: files.map((f) => f.name), text: caption || undefined } });
}

/** One PDF as one message. */
export async function sendPdf(customerId: string, file: LocalFile & { size: number }) {
  const pdfKey = await uploadFile(`${thread(customerId)}/presign`, file);
  return api<Message>(thread(customerId), { body: { kind: 'pdf', pdfKey, pdfName: file.name, pdfSize: file.size } });
}

/** A recorded voice note (AAC in an .m4a / .mp4 file). */
export async function sendVoice(customerId: string, uri: string, durationSec: number) {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() === 'mp4' ? 'mp4' : 'm4a';
  const audioKey = await uploadFile(`${thread(customerId)}/presign`, { uri, type: 'audio/mp4', name: `voice-note-${Date.now()}.${ext}` });
  return api<Message>(thread(customerId), { body: { kind: 'voice', audioKey, durationSec } });
}

/** Opening the chat marks it read for you, as on the web. */
export function markNotesRead(customerId: string) {
  return api<unknown>(`/api/customers/${encodeURIComponent(customerId)}/messages/read-receipts`, { method: 'POST' });
}

/** A 2-minute link to play a voice note (the phone's audio player can't send our login header). */
export function voiceLink(messageId: string) {
  return api<{ url: string }>(`/api/mobile/voice/${encodeURIComponent(messageId)}`).then((r) => r.url);
}
