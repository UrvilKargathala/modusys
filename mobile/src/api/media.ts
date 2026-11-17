// A customer's gallery (site photos, videos, documents): the same endpoints as the
// web's CRM "Media" tab. Uploading is the web's three steps
// (web/lib/upload-to-storage.ts): ask our server for a short-lived upload link,
// PUT the file straight to storage (Garage), then save the record with the key.
import { api } from './client';

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

/** PUT the bytes to the presigned link. Content-Type must be the one that was signed. */
function put(url: string, body: Blob, contentType: string, onProgress?: (fraction: number) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => reject(new Error("Couldn't upload the photo. Check your connection and try again."));
    xhr.send(body);
  });
}

/** Uploads one photo from the camera or gallery and adds it to the customer's gallery. */
export async function uploadPhoto(
  customerId: string,
  photo: { uri: string; type?: string; fileName?: string },
  onProgress?: (fraction: number) => void,
): Promise<MediaItem> {
  const blob = await (await fetch(photo.uri)).blob();
  // The iOS picker reports JPEGs as "image/jpg"; the server (and the standard) only knows "image/jpeg".
  const reported = (photo.type || blob.type || 'image/jpeg').toLowerCase();
  const contentType = reported === 'image/jpg' ? 'image/jpeg' : reported;
  const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
  const name = photo.fileName || `site-photo-${Date.now()}.${ext}`;

  // A link lives about 2 minutes: get a fresh one, and once more if storage turned it down as expired.
  for (let attempt = 1; ; attempt++) {
    const { putUrl, key } = await api<{ putUrl: string; key: string }>(`${base(customerId)}/presign`, {
      body: { name, contentType, size: blob.size },
    });
    const status = await put(putUrl, blob, contentType, onProgress);
    if (status >= 200 && status < 300) {
      return api<MediaItem>(base(customerId), { body: { key, name } });
    }
    if (attempt >= 2 || (status !== 400 && status !== 403)) {
      throw new Error(`Couldn't upload the photo (${status}). Please try again.`);
    }
  }
}
