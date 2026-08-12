import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
]);

type Ctx = { params: Promise<{ id: string }> };

// POST multipart/form-data with a `file` blob. Used by the CRM chat composer
// for image/pdf/voice attachments — the resulting URL is then handed to
// POST /api/customers/[id]/messages as imageUrl/pdfUrl/audioUrl.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId } = await params;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File exceeds ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit` }, { status: 413 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ACCEPT.has(mime)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  const ext = mime.split("/")[1] || "bin";
  const key = `crm/${customerId}/${Date.now()}.${ext}`;

  try {
    const blob = await put(key, file, {
      access: "public",
      contentType: mime,
      addRandomSuffix: false,
    });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
