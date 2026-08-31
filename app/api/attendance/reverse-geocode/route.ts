import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/require-user";
import { reverseGeocodeShort } from "@/lib/server/reverse-geocode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Powers the live GPS badge on the check-in selfie (My Attendance) — a
// short "Adajan, Surat" label, not the full address stored on the record.
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const label = await reverseGeocodeShort(lat, lng);
  return NextResponse.json({ label });
}
