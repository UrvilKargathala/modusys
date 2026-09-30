import { NextRequest, NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { istDateString } from "@/lib/attendance-config";
import { newKey, putServerFile } from "@/lib/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 500 * 1024;
const ACCEPT = new Set(["image/jpeg", "image/png"]);

// POST multipart/form-data with a `photo` blob + `side` ("checkIn" | "checkOut").
// Returns { key } once the selfie is stored in Garage. The unified check-in/out
// endpoints (/api/attendance/check-in, /api/attendance/check-out) take this key
// back as the selfie proof. Selfies are ≤500 KB, so they go through the server
// (no presigned PUT needed).
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
  const side = form?.get("side") === "checkOut" ? "checkOut" : "checkIn";
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

  const ext = mime === "image/png" ? "png" : "jpg";
  // attendance/<employeeId>/<IST-day>/<ts>-<rand8>-<side>.<ext> — server-minted, so two uploads
  // in the same millisecond can never overwrite each other.
  const key = newKey("attendance", `${employee.id}/${istDateString()}`, `${side}.${ext}`);

  try {
    await putServerFile(key, Buffer.from(await file.arrayBuffer()), mime);
    return NextResponse.json({ key });
  } catch (e) {
    console.error("[Modusys] attendance photo upload failed", (e as { name?: string })?.name);
    return NextResponse.json({ error: "Photo upload failed" }, { status: 500 });
  }
}
