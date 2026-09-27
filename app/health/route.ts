import { NextResponse } from "next/server";

// Liveness/readiness probe for Docker/Coolify. No auth, no DB access, no
// external calls — just confirms the Next.js server is up and serving.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
