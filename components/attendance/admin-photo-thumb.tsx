"use client";

import { useState } from "react";

// Small thumbnail used in the admin attendance table. Loads the photo via
// the /api/attendance/photo/[recordId]/[type] broker (which 302's to the
// blob URL after role check). Click opens a fullscreen lightbox.
export function AdminPhotoThumb({
  recordId,
  side,
  title,
}: {
  recordId: string;
  side: "checkIn" | "checkOut";
  title?: string;
}) {
  const [big, setBig] = useState(false);
  const src = `/api/attendance/photo/${recordId}/${side}`;
  return (
    <>
      <button
        type="button"
        onClick={() => setBig(true)}
        title={title}
        aria-label={`Open ${title ?? side} photo`}
        className="block"
      >
        <img src={src} alt={title ?? side} className="h-10 w-10 rounded object-cover" />
      </button>
      {big && (
        <div
          onClick={() => setBig(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <img src={src} alt="" className="max-h-full max-w-full rounded shadow-xl" />
        </div>
      )}
    </>
  );
}
