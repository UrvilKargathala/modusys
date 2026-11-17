// A customer's notes: the web calls them the customer chat (CRM customer panel).
// Same endpoints: list, send a text note, and mark everything read on opening.
import { api } from './client';

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

/** A plain text note, like typing in the web chat without @mentions. */
export function sendNote(customerId: string, text: string) {
  return api<Message>(`/api/customers/${encodeURIComponent(customerId)}/messages`, {
    body: { kind: 'chat', text },
  });
}

/** Opening the chat marks it read for you, as on the web. */
export function markNotesRead(customerId: string) {
  return api<unknown>(`/api/customers/${encodeURIComponent(customerId)}/messages/read-receipts`, { method: 'POST' });
}
