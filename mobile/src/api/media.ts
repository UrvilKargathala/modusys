// A customer's gallery (site photos, videos, documents): the same endpoints as the
// web's CRM "Media" tab. Uploading is the web's three steps
// (web/lib/upload-to-storage.ts): ask our server for a short-lived upload link,
// PUT the file straight to storage (Garage), then save the record with the key.
import { api } from './client';
import { cleanType, uploadFile } from './upload';

/** As /api/customers/[id]/media sends it (backend/server/serialize.ts serializeMediaAttachment). */
export type MediaItem = {
  id: string;
  customerId: string;
  type: 'image' | 'video' | 'document';
  name: string;
  /** Login-gated /api/files/media_<id>; load with imageSource(). */
  url: string;
  sizeBytes: number;
  durationSec?: number;
  uploadedAt: string;
};

const base = (customerId: string) => `/api/customers/${encodeURIComponent(customerId)}/media`;

export function listMedia(customerId: string) {
  return api<MediaItem[]>(base(customerId));
}

/** Uploads one photo from the camera or gallery and adds it to the customer's gallery. */
export async function uploadPhoto(
  customerId: string,
  photo: { uri: string; type?: string; fileName?: string },
  onProgress?: (fraction: number) => void,
): Promise<MediaItem> {
  const contentType = cleanType(photo.type || 'image/jpeg');
  const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
  const name = photo.fileName || `site-photo-${Date.now()}.${ext}`;
  const key = await uploadFile(`${base(customerId)}/presign`, { uri: photo.uri, type: contentType, name }, onProgress);
  return api<MediaItem>(base(customerId), { body: { key, name } });
}
