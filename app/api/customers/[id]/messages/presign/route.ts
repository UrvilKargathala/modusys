import { handlePresign } from "@/lib/server/presign";

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

// Chat attachment upload, step 1 of 3: presigned PUT straight to Garage, then the message row
// is saved via POST /api/customers/[id]/messages with the returned key(s). Replaces the old
// Vercel Blob token route.
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id: customerId } = await params;
  return handlePresign(req, { prefix: "crm", owner: customerId, accept: ACCEPT, maxBytes: MAX_BYTES });
}
