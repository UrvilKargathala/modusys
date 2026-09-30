import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeMediaAttachment } from "@/lib/server/serialize";
import { requireUser } from "@/lib/server/require-user";
import { headObject } from "@/lib/server/s3";

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
// straight to Garage via a presigned PUT from ./presign (bypasses the serverless body cap).
// The row stores the storage key in `pathname`; `url` is legacy and stays empty for new rows.
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { id: customerId } = await params;
  const b = await req.json();

  const key = typeof b.key === "string" ? b.key : "";
  // Keys are minted server-side under customers/<id>/ — reject anything else (E4).
  if (!key.startsWith(`customers/${customerId}/`) || typeof b.name !== "string") {
    return NextResponse.json({ error: "key and name are required" }, { status: 400 });
  }

  // Confirm the bytes actually landed (E3) and trust storage, not the client, for type and size.
  const head = await headObject(key).catch(() => null);
  if (!head) return NextResponse.json({ error: "File not found in storage" }, { status: 400 });
  const contentType = head.ContentType ?? "";
  const type = contentType.startsWith("image/") ? "image" : contentType.startsWith("video/") ? "video" : "document";

  const media = await prisma.mediaAttachment.create({
    data: {
      customerId,
      type,
      name: b.name,
      url: "",
      pathname: key,
      sizeBytes: head.ContentLength ?? 0,
      durationSec: typeof b.durationSec === "number" ? b.durationSec : undefined,
      uploadedById: auth.user.id,
    },
  });
  return NextResponse.json(serializeMediaAttachment(media), { status: 201 });
}
