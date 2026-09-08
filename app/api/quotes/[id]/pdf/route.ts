import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/require-user";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// Renders the existing client /quotes/[id]/pdf page in a real headless
// browser and prints it to PDF server-side — the fix for print output that
// depended on whatever browser/OS the visitor's phone happened to use
// (iOS Safari's print pipeline doesn't reflow to the page width at all,
// which no amount of print CSS on our side can work around). Puppeteer
// gives every download the same fixed-viewport render regardless of device.
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id }, select: { quoteNumber: true } });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ponytail: local dev drives the Mac's own Chrome (no vendored binary to
  // fight with); Vercel/production uses @sparticuz/chromium's serverless
  // build. Swap this if dev ever needs a different local Chrome path.
  const isVercel = !!process.env.VERCEL;
  const [puppeteer, chromium] = await Promise.all([
    import("puppeteer-core"),
    isVercel ? import("@sparticuz/chromium") : Promise.resolve(null),
  ]);

  const browser = await puppeteer.default.launch(
    isVercel
      ? {
          args: chromium!.default.args,
          executablePath: await chromium!.default.executablePath(),
          headless: true,
        }
      : {
          executablePath:
            process.env.CHROME_EXECUTABLE_PATH ??
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          headless: true,
        }
  );

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 2 });

    // Forward the caller's own session cookie so the internal page's
    // client-side data fetches (customers, unit types, pricing, …) succeed
    // exactly as they would in the visitor's own browser.
    const cookie = req.headers.get("cookie");
    if (cookie) await page.setExtraHTTPHeaders({ cookie });

    const origin = new URL(req.url).origin;
    await page.goto(`${origin}/quotes/${id}/pdf?download=1`, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForSelector('[data-pdf-ready="true"]', { timeout: 15000 });
    // The stores' fetches resolve independently of the "ready" marker
    // (which only gates on the quote itself) — a short settle window
    // covers customer/architect/pricing data arriving just after.
    await new Promise((r) => setTimeout(r, 500));

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // use the @page { margin } rule already tuned for this sheet
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quote.quoteNumber}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
