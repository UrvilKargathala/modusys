import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { WEBSITE_INQUIRY_STAGE } from "@shared/constants/websiteInquiries";

// Signature = hex HMAC-SHA256 of `${timestamp}.${rawBody}` with THEFURN_WEBHOOK_SECRET.
// The website sends X-TheFurn-Timestamp (unix ms) and X-TheFurn-Signature.
const MAX_SKEW_MS = 5 * 60_000;

export function verifyTheFurnSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const secret = process.env.THEFURN_WEBHOOK_SECRET;
  if (!secret || secret.length < 32 || !timestamp || !signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export type TheFurnInquiry = {
  externalId: string;
  submittedAt: string;
  name: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  inquiryType: string;
  budgetLabel: string;
  tier: string;
  message: string;
  pageUrl: string;
};

const dmyTime = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Everything the Customer record has no column for, as the card's first note.
function detailsText(d: TheFurnInquiry, repeat: boolean): string {
  return [
    repeat ? "Website inquiry again (thefurn.co contact form)" : "Website inquiry (thefurn.co contact form)",
    `Submitted: ${dmyTime(new Date(d.submittedAt))}`,
    `Name: ${d.name}`,
    `Phone: ${d.phone}`,
    d.email && `Email: ${d.email}`,
    (d.city || d.state) && `Location: ${[d.city, d.state].filter(Boolean).join(", ")}`,
    d.inquiryType && `Looking for: ${d.inquiryType}`,
    d.budgetLabel && `Budget: ${d.budgetLabel}${d.tier ? ` (${d.tier})` : ""}`,
    d.message && `Message: ${d.message}`,
    d.pageUrl && `Page: ${d.pageUrl}`,
  ].filter(Boolean).join("\n");
}

export type IngestResult = { customerId: string; outcome: "created" | "merged" | "duplicate" };

/**
 * One website submission → one Tickets card. Safe to call again with the same
 * externalId (returns the first result). A phone that already belongs to a
 * live customer gets a note on that card instead of a second card.
 */
export async function ingestTheFurnInquiry(d: TheFurnInquiry, raw: unknown): Promise<IngestResult> {
  const seen = await prisma.websiteInquiry.findUnique({ where: { externalId: d.externalId }, select: { customerId: true } });
  if (seen) return { customerId: seen.customerId, outcome: "duplicate" };

  const phoneNormalized = normalizePhone(d.phone);
  const submittedAt = new Date(d.submittedAt);

  try {
    return await prisma.$transaction(async (tx) => {
      const match = phoneNormalized.length === 10
        ? await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Customer"
            WHERE "deletedAt" IS NULL
              AND right(regexp_replace("mobile", '\\D', '', 'g'), 10) = ${phoneNormalized}
            ORDER BY "lastActivity" DESC LIMIT 1`
        : [];

      let customerId: string;
      let outcome: "created" | "merged";
      if (match[0]) {
        customerId = match[0].id;
        outcome = "merged";
        await tx.customer.update({ where: { id: customerId }, data: { lastActivity: new Date() } });
      } else {
        const [firstName, ...rest] = d.name.trim().split(/\s+/);
        const lastName = rest.join(" ");
        const max = await tx.customer.aggregate({ _max: { srNo: true } });
        const c = await tx.customer.create({
          data: {
            name: d.name.trim(),
            firstName: firstName ?? "",
            lastName,
            srNo: (max._max.srNo ?? 0) + 1,
            customerCode: `${firstName?.[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase(),
            mobile: d.phone,
            email: d.email,
            city: d.city,
            state: d.state,
            stage: WEBSITE_INQUIRY_STAGE,
          },
          select: { id: true },
        });
        customerId = c.id;
        outcome = "created";
      }

      await tx.message.create({ data: { customerId, kind: "system", senderId: null, text: detailsText(d, outcome === "merged") } });
      await tx.websiteInquiry.create({
        data: { externalId: d.externalId, phoneNormalized, rawPayload: raw as Prisma.InputJsonValue, submittedAt, customerId, outcome },
      });
      return { customerId, outcome };
    });
  } catch (e) {
    // Two retries racing: the unique externalId lets one through, the other lands here.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prisma.websiteInquiry.findUnique({ where: { externalId: d.externalId }, select: { customerId: true } });
      if (row) return { customerId: row.customerId, outcome: "duplicate" };
    }
    throw e;
  }
}
