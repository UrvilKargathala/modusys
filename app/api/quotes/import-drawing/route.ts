import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";
import { rateLimit } from "@/lib/server/rate-limit";
import { reportRouteError } from "@/lib/server/report-error";
import { loadImportLists, readDrawing } from "@/lib/server/drawing-import";
import { keepAliveJson } from "@/lib/server/keep-alive-json";
import { finalizeDraft } from "@/lib/drawing-import";

// Quotes → New → Import from drawing: one PDF in, the draft quote out (docs/PDF_TO_QUOTE_PLAN.md).
// Nothing is saved here; the quote form fills from the answer and staff save it as usual.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600; // one Claude call takes 1–5 min (a 39-unit kitchen took 260 s)

const MAX_BYTES = 20 * 1024 * 1024;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  if (!process.env.ANTHROPIC_API_KEY) return fail("Drawing import is not set up on this server (no Claude API key).", 503);
  // Each read costs money: at most 20 drawings per person per hour.
  if (!rateLimit(`import-drawing:${auth.user.id}`, 20, 60 * 60 * 1000).ok) return fail("Too many drawings read in the last hour. Try again later.", 429);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a drawing PDF.", 400);
  if (file.size > MAX_BYTES) return fail("The PDF is over 20 MB.", 413);
  const pdf = Buffer.from(await file.arrayBuffer());
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") return fail("That file is not a PDF.", 400);

  // From here the answer is a 200 stream (see keepAliveJson); failures come back as { error }.
  return keepAliveJson(async () => {
    try {
      const lists = await loadImportLists(prisma);
      const { draft, usage, ms } = await readDrawing(pdf, lists);
      return {
        final: finalizeDraft(draft, lists),
        spec: draft.spec,
        excluded: draft.excluded,
        seconds: Math.round(ms / 1000),
        tokens: { input: usage.input_tokens, output: usage.output_tokens },
      };
    } catch (error) {
      const code = await reportRouteError(req, error);
      if (error instanceof Anthropic.AuthenticationError) return { error: `The Claude API key was refused. Error code ${code}.` };
      if (error instanceof Anthropic.RateLimitError || (error instanceof Anthropic.APIError && error.status === 529)) {
        return { error: `Claude is busy right now. Try again in a minute. Error code ${code}.` };
      }
      const message = error instanceof Error && /declined|cut off/.test(error.message) ? error.message : "Could not read the drawing";
      return { error: `${message}. Error code ${code}.` };
    }
  });
}
