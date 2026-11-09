import { handlePresign } from "@/lib/server/presign";
import { requireRole } from "@/lib/server/require-user";
import { ACCOUNTS_ROLES } from "@/lib/server/accounts-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // a photo of a bill or a PDF
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Receipt / bill upload for an account entry, step 1: a presigned PUT under accounts/. Saved on the entry as attachmentKey.
export async function POST(req: Request) {
  const auth = await requireRole(ACCOUNTS_ROLES);
  if (auth.response) return auth.response;
  return handlePresign(req, { prefix: "accounts", owner: "entries", accept: ACCEPT, maxBytes: MAX_BYTES });
}
