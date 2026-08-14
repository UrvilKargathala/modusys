import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
];

// Client-direct upload: the browser calls this endpoint (via
// @vercel/blob/client `upload()`), we hand back a short-lived signed token
// after auth + type/size validation, and the browser uploads straight to
// Vercel Blob storage. This bypasses Vercel's ~4.5 MB serverless-function
// request-body cap so real 20 MB attachments work in production.
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id: customerId } = await params;
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const auth = await requireUser();
        if (auth.response) throw new Error("Unauthorized");
        return {
          allowedContentTypes: ACCEPT,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          // Prefix the pathname so all chat uploads stay grouped by customer
          // and can be located in the Blob dashboard.
          tokenPayload: JSON.stringify({ customerId }),
        };
      },
      onUploadCompleted: async () => {
        // No-op — the message record is created by the client once it has
        // the blob URL, via POST /api/customers/[id]/messages.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 }
    );
  }
}
