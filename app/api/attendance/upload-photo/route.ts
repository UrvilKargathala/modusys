import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { istDateString } from "@/lib/attendance-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 500 * 1024;
const ACCEPT = new Set(["image/jpeg", "image/png"]);

// POST multipart/form-data with a `photo` blob + `side` ("checkIn" | "checkOut").
// Returns { url, key } once the blob is uploaded. The unified check-in/out
// endpoints (/api/attendance/check-in, /api/attendance/check-out) hand this
// URL back to the server as the selfie proof.
export async function POST(req: NextRequest) {
  const { user, employee } = await getCurrentEmployee();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!employee) {
    return NextResponse.json(
      { error: "Your user account is not linked to an employee record." },
      { status: 403 }
    );
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  const side = String(form?.get("side") ?? "checkIn");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "photo field is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Photo exceeds ${Math.round(MAX_BYTES / 1024)}KB limit` }, { status: 413 });
  }
  const mime = file.type || "image/jpeg";
  if (!ACCEPT.has(mime)) {
    return NextResponse.json({ error: "Only JPEG or PNG allowed" }, { status: 415 });
  }

  const day = istDateString();
  const stamp = Date.now();
  const ext = mime === "image/png" ? "png" : "jpg";
  const key = `attendance/${employee.id}/${day}/${side}-${stamp}.${ext}`;

  try {
    const blob = await put(key, file, {
      access: "public", // v2 of @vercel/blob only supports "public"; the URL is unlisted (random path suffix). App-level broker at /api/attendance/photo/[id]/[type] gates who can even learn the URL.
      contentType: mime,
      addRandomSuffix: false,
    });
    return NextResponse.json({ url: blob.url, key: blob.pathname });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
