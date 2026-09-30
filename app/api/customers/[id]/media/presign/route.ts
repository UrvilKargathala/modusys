import { handlePresign } from "@/lib/server/presign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 100 * 1024 * 1024; // covers site-visit video clips, not just photos
const ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// Gallery upload, step 1 of 3: the browser gets a short-lived presigned PUT here, uploads
// straight to Garage (so 100 MB videos never pass through Node), then saves the row via
// POST /api/customers/[id]/media with the returned key. Replaces the old Vercel Blob token route.
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id: customerId } = await params;
  return handlePresign(req, { prefix: "customers", owner: customerId, accept: ACCEPT, maxBytes: MAX_BYTES });
}
