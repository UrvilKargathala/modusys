import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeMediaAttachment } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId } = await params;
  const media = await prisma.mediaAttachment.findMany({
    where: { customerId },
    orderBy: { uploadedAt: "asc" },
  });
  return NextResponse.json(media.map(serializeMediaAttachment));
}

// Creates the DB record after the client has already uploaded the file
// straight to Vercel Blob via ./upload (client-direct upload, same pattern
// as the chat attachment flow — bypasses the ~4.5MB serverless body cap).
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId } = await params;
  const b = await req.json();

  const type = ["image", "video", "document"].includes(b.type) ? b.type : "document";
  if (typeof b.url !== "string" || typeof b.pathname !== "string" || typeof b.name !== "string") {
    return NextResponse.json({ error: "url, pathname and name are required" }, { status: 400 });
  }

  const media = await prisma.mediaAttachment.create({
    data: {
      customerId,
      type,
      name: b.name,
      url: b.url,
      pathname: b.pathname,
      sizeBytes: typeof b.sizeBytes === "number" ? b.sizeBytes : 0,
      durationSec: typeof b.durationSec === "number" ? b.durationSec : undefined,
      uploadedById: auth.user.id,
    },
  });
  return NextResponse.json(serializeMediaAttachment(media), { status: 201 });
}
