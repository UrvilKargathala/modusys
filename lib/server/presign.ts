import "server-only";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/require-user";
import { newKey, presignPut } from "@/lib/server/s3";

// Shared by the gallery and chat presign routes (migration doc §2.2, §8.2):
// auth → validate type + size → mint the key server-side → presigned PUT.
// The signed Content-Type/Content-Length pin the upload to exactly what was validated here (E4).
export async function handlePresign(
  req: Request,
  opts: { prefix: string; owner: string; accept: string[]; maxBytes: number }
) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const b = await req.json().catch(() => null);
  const name = typeof b?.name === "string" ? b.name : "";
  const contentType = typeof b?.contentType === "string" ? b.contentType : "";
  const size = typeof b?.size === "number" ? b.size : NaN;

  // Voice notes arrive as "audio/webm;codecs=opus" — match on the base type, sign the exact string.
  const base = contentType.split(";")[0].trim().toLowerCase();
  if (!name || !opts.accept.includes(base)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }
  if (!Number.isInteger(size) || size <= 0 || size > opts.maxBytes) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const key = newKey(opts.prefix, opts.owner, name);
  return NextResponse.json({ putUrl: await presignPut(key, contentType, size), key });
}
