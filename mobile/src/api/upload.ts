// Upload a local file (photo, PDF, voice note) straight to storage, the web's three steps
// (web/lib/upload-to-storage.ts): ask our server for a short-lived upload link, PUT the bytes to storage (Garage),
// and hand back the storage key for the record that is saved next.
import { api } from './client';

export type LocalFile = { uri: string; type: string; name: string };

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
    xhr.onerror = () => reject(new Error("Couldn't upload the file. Check your connection and try again."));
    xhr.send(body);
  });
}

/** The iOS picker reports JPEGs as "image/jpg"; the server (and the standard) only knows "image/jpeg". */
export const cleanType = (t: string) => (t.toLowerCase() === 'image/jpg' ? 'image/jpeg' : t.toLowerCase());

/** Uploads one file through `presignPath` and returns its storage key. */
export async function uploadFile(presignPath: string, file: LocalFile, onProgress?: (fraction: number) => void): Promise<string> {
  const blob = await (await fetch(file.uri)).blob();
  const contentType = cleanType(file.type || blob.type);
  // A link lives about 2 minutes: get a fresh one, and once more if storage turned it down as expired.
  for (let attempt = 1; ; attempt++) {
    const { putUrl, key } = await api<{ putUrl: string; key: string }>(presignPath, { body: { name: file.name, contentType, size: blob.size } });
    const status = await put(putUrl, blob, contentType, onProgress);
    if (status >= 200 && status < 300) return key;
    if (attempt >= 2 || (status !== 400 && status !== 403)) throw new Error(`Couldn't upload the file (${status}). Please try again.`);
  }
}
