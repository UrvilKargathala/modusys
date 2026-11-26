import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { PrismaClient } from "@prisma/client";
import { DRAWING_RULES, draftSchema, type Draft, type ImportLists } from "@shared/drawing-import";

// Server side of the drawing import (docs/PDF_TO_QUOTE_PLAN.md): the lists the model may pick from, and the
// one Claude call. Reads ANTHROPIC_API_KEY, so only import it from API routes and scripts. No "server-only"
// import because scripts/drawing-import-test.ts runs it outside Next.js.

export const DRAWING_MODEL = "claude-opus-5-5";

export async function loadImportLists(db: PrismaClient): Promise<ImportLists> {
  const [unitTypes, items, prices] = await Promise.all([
    db.unitType.findMany({ where: { deleted: false, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.materialItem.findMany({ where: { deleted: false }, select: { id: true, name: true, category: true } }),
    db.furniturePriceItem.findMany({
      where: { deleted: false, variantId: { not: "" } },
      select: { variantId: true, thicknessId: true, externalColourId: true },
    }),
  ]);
  const nameOf = new Map(items.map((i) => [i.id, i.name.trim()]));
  const category = (c: string) => items.filter((i) => i.category === c).map((i) => ({ id: i.id, name: i.name.trim() }));
  return {
    unitTypes: unitTypes.map((u) => ({ id: u.id, name: u.name.trim() })),
    productTypes: category("product-type"),
    cabinetDescriptions: category("raw-material-description"),
    handles: category("handle-type"),
    hinges: category("hinges-type"),
    tandemDrawerTypes: category("tandem-drawer-type"),
    spaces: category("space"),
    variants: prices.map((p) => ({
      variantId: p.variantId,
      thickness: nameOf.get(p.thicknessId) ?? "",
      externalColour: nameOf.get(p.externalColourId) ?? "",
    })),
  };
}

// One call per drawing, 1–5 min. Streams so a long answer can't hit the HTTP timeout; the answer is forced
// into draftSchema (unit types, spaces and spec options are enums from the DB), then checked again with Zod.
export async function readDrawing(pdf: Buffer, lists: ImportLists, client = new Anthropic()) {
  const started = Date.now();
  const schema = draftSchema(lists);
  const stream = client.beta.messages.stream({
    model: DRAWING_MODEL,
    max_tokens: 32000,
    // If the safety check declines, the API retries on a fallback model inside the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(schema) },
    system: DRAWING_RULES,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          { type: "text", text: "List the units in this drawing." },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error(`Claude declined to read this drawing (${message.stop_details?.category ?? "no reason given"})`);
  }
  if (message.stop_reason === "max_tokens") throw new Error("The answer for this drawing was cut off; try again");
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const draft: Draft = schema.parse(JSON.parse(text));
  return { draft, usage: message.usage, model: message.model, ms: Date.now() - started };
}
