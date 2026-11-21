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
  /** The message this one answers (Reply). */
  replyToMessageId?: string;
  /** Starred by you (stars are per person, as on the website). */
  starred?: boolean;
  /** People @mentioned: the server gave each a follow-up task (the website shows "Task → name"). */
  mentionedUserIds?: string[];
};

export function listMessages(customerId: string) {
  return api<Message[]>(`/api/customers/${encodeURIComponent(customerId)}/messages`);
}

const thread = (customerId: string) => `/api/customers/${encodeURIComponent(customerId)}/messages`;

/**
 * A text message. `mentionedUserIds` are the people picked with @ (the text holds "@Name"); as on the website, the
 * server gives each of them a follow-up task and a bell notification.
 */
export function sendNote(customerId: string, text: string, mentionedUserIds: string[] = [], replyToMessageId?: string) {
  return api<Message>(thread(customerId), { body: { kind: 'chat', text, mentionedUserIds, replyToMessageId } });
}

/** Photos as one message, with the typed text as the caption (the website's image group). */
export async function sendImages(customerId: string, files: LocalFile[], caption: string, replyToMessageId?: string) {
  const imageKeys = await Promise.all(files.map((f) => uploadFile(`${thread(customerId)}/presign`, f)));
  return api<Message>(thread(customerId), {
    body: { kind: 'image', imageKeys, imageNames: files.map((f) => f.name), text: caption || undefined, replyToMessageId },
  });
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

const one = (customerId: string, messageId: string) => `${thread(customerId)}/${encodeURIComponent(messageId)}`;

/** Add an emoji reaction, or take yours back if you already used it (the website's toggle). */
export function reactToMessage(customerId: string, messageId: string, emoji: string) {
  return api<Message>(`${one(customerId, messageId)}/reactions`, { body: { emoji } });
}

/** Star or unstar for yourself. */
export function toggleStar(customerId: string, messageId: string) {
  return api<Message>(`${one(customerId, messageId)}/star`, { method: 'POST' });
}

/** "me" hides it for you; "everyone" removes it (the sender or a super admin only: the server decides). */
export function deleteMessage(customerId: string, messageId: string, scope: 'me' | 'everyone') {
  return api<{ ok: boolean; scope: string }>(`${one(customerId, messageId)}?scope=${scope}`, { method: 'DELETE' });
}

/** Change the text of your own message (the server refuses anyone else's). */
export function editMessage(customerId: string, messageId: string, text: string) {
  return api<Message>(one(customerId, messageId), { method: 'PATCH', body: { text } });
}

/** Copy a message into other customers' chats (marked Forwarded there). */
export function forwardMessage(customerId: string, messageId: string, targetCustomerIds: string[]) {
  return api<unknown>(`${one(customerId, messageId)}/forward`, { body: { targetCustomerIds } });
}

/** Who has read a message, and when (the website's message info). */
export function messageReaders(customerId: string, messageId: string) {
  return api<{ receipts: { userId: string; readAt: string }[] }>(
    `${thread(customerId)}/read-receipts?messageId=${encodeURIComponent(messageId)}`,
  ).then((r) => r.receipts);
}
