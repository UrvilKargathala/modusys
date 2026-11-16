// Browser-direct upload to Garage via a presigned PUT (migration doc §2.2).
// Mints the URL on demand from `presignUrl`, PUTs the file with XHR (fetch can't report
// upload progress), and returns the storage key to save on the DB row.
export async function uploadToStorage(
  presignUrl: string,
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<string> {
  const contentType = file.type || "application/octet-stream";
  const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
  const name = file instanceof File ? file.name : `${Date.now()}.${ext}`;

  // A presigned PUT lives ~2 min (E7): mint fresh per upload, and re-mint once if it was rejected.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(presignUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contentType, size: file.size }),
    });
    if (!res.ok) throw new Error("presign failed");
    const { putUrl, key } = (await res.json()) as { putUrl: string; key: string };

    const status = await put(putUrl, file, contentType, onProgress);
    if (status >= 200 && status < 300) return key;
    // Garage answers an expired link with 400 "Date is too old" (S3 itself uses 403) — retry once with a fresh link.
    if (attempt >= 2 || (status !== 403 && status !== 400)) throw new Error(`upload failed (${status})`);
  }
}

function put(url: string, file: File | Blob, contentType: string, onProgress?: (p: number) => void) {
  return new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // Must match the Content-Type that was signed into the URL.
    xhr.setRequestHeader("Content-Type", contentType);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
      };
    }
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => reject(new Error("network error"));
    xhr.send(file);
  });
}
