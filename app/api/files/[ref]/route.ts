import { NextResponse } from "next/server";
import { Readable } from "stream";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { getObject, headObject } from "@/lib/server/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// File broker (Blob→Garage migration doc §8.7). Permanent, login-gated addresses:
//   /api/files/msg_<messageId>[?i=<n>]         chat image (nth) | pdf | voice note
//   /api/files/media_<mediaId>                 customer gallery item
//   /api/files/att_<recordId>?side=checkIn|checkOut   attendance selfie
//   ...add ?download=1 to force "Save as" with the original filename.
// Bytes are streamed from the private Garage bucket; Range/206 is implemented here
// because Vercel Blob used to serve it for free.

type Target = { key: string; name: string };
type Denied = NextResponse;

async function resolve(ref: string, sp: URLSearchParams): Promise<Target | Denied> {
  const sep = ref.indexOf("_");
  const kind = sep > 0 ? ref.slice(0, sep) : "";
  const id = sep > 0 ? ref.slice(sep + 1) : "";
  if (!id) return NextResponse.json({ error: "Bad ref" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

  if (kind === "msg") {
    const m = await prisma.message.findUnique({
      where: { id },
      select: { imageKeys: true, imageNames: true, imageName: true, pdfKey: true, pdfName: true, audioKey: true },
    });
    if (!m) return notFound();
    if (m.imageKeys.length > 0) {
      const i = Number(sp.get("i") ?? 0);
      const key = Number.isInteger(i) && i >= 0 ? m.imageKeys[i] : undefined;
      if (!key) return notFound();
      return { key, name: m.imageNames[i] ?? m.imageName ?? `image-${id}-${i + 1}` };
    }
    if (m.pdfKey) return { key: m.pdfKey, name: m.pdfName ?? `document-${id}.pdf` };
    if (m.audioKey) return { key: m.audioKey, name: `voice-${id}.webm` };
    return notFound();
  }

  if (kind === "media") {
    const a = await prisma.mediaAttachment.findUnique({ where: { id }, select: { pathname: true, name: true } });
    if (!a?.pathname) return notFound();
    return { key: a.pathname, name: a.name };
  }

  if (kind === "att") {
    const side = sp.get("side") === "checkOut" ? "checkOut" : "checkIn";
    const select = { employeeId: true, checkInPhotoKey: true, checkOutPhotoKey: true } as const;
    const rec =
      (await prisma.attendanceRecord.findUnique({ where: { id }, select })) ??
      (await prisma.photoAttendanceRecord.findUnique({ where: { id }, select }));
    if (!rec) return notFound();
    // Same rule as the old photo route: super-admin, or the employee who owns the record.
    if (user.role !== "super-admin") {
      const { employee } = await getCurrentEmployee();
      if (!employee || employee.id !== rec.employeeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    const key = side === "checkOut" ? rec.checkOutPhotoKey : rec.checkInPhotoKey;
    if (!key) return notFound();
    return { key, name: key.split("/").pop() ?? `attendance-${id}.jpg` };
  }

  return NextResponse.json({ error: "Bad ref" }, { status: 400 });
}

// RFC 5987: bare filename="..." breaks on quotes, non-ASCII and newlines.
function contentDisposition(download: boolean, name: string) {
  if (!download) return "inline";
  const ascii = name.replace(/["\\\r\n]/g, "").replace(/[^\x20-\x7e]/g, "_") || "download";
  const utf8 = encodeURIComponent(name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

function isMissing(e: unknown) {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
  return err?.name === "NoSuchKey" || err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404;
}

function isBadRange(e: unknown) {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
  return err?.name === "InvalidRange" || err?.$metadata?.httpStatusCode === 416;
}

async function handle(req: Request, ctx: { params: Promise<{ ref: string }> }, headOnly: boolean) {
  const { ref } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const target = await resolve(ref, sp);
  if (target instanceof NextResponse) return target;

  const baseHeaders = (type: string | undefined, etag: string | undefined) => {
    const h = new Headers({
      "Content-Type": type || "application/octet-stream", // stored type, never sniffed
      "Content-Disposition": contentDisposition(sp.get("download") === "1", target.name),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    if (etag) h.set("ETag", etag);
    return h;
  };

  try {
    if (headOnly) {
      const head = await headObject(target.key);
      const h = baseHeaders(head.ContentType, head.ETag);
      if (head.ContentLength != null) h.set("Content-Length", String(head.ContentLength));
      return new NextResponse(null, { status: 200, headers: h });
    }

    // Conditional request: skip the download entirely when the browser's copy is current.
    const inm = req.headers.get("if-none-match");
    const range = req.headers.get("range") ?? undefined;
    if (inm && !range) {
      const head = await headObject(target.key);
      if (head.ETag && inm === head.ETag) {
        return new NextResponse(null, { status: 304, headers: baseHeaders(head.ContentType, head.ETag) });
      }
    }

    const obj = await getObject(target.key, range);
    const body = obj.Body as Readable | undefined;
    if (!body) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const partial = obj.$metadata.httpStatusCode === 206;
    const h = baseHeaders(obj.ContentType, obj.ETag);
    if (obj.ContentLength != null) h.set("Content-Length", String(obj.ContentLength));
    if (partial && obj.ContentRange) h.set("Content-Range", obj.ContentRange);

    // Client closed the tab / seeked elsewhere: drop the upstream Garage stream.
    req.signal.addEventListener("abort", () => body.destroy(), { once: true });
    return new NextResponse(Readable.toWeb(body) as ReadableStream, { status: partial ? 206 : 200, headers: h });
  } catch (e) {
    if (isMissing(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (isBadRange(e)) {
      const len = await headObject(target.key).then((r) => r.ContentLength).catch(() => undefined);
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${len ?? "*"}` } });
    }
    // Log the ref and outcome only — never keys or URLs (§8.7 step 9).
    console.error("[files] broker failure", ref, (e as { name?: string })?.name);
    return NextResponse.json({ error: "Storage error" }, { status: 502 });
  }
}

export const GET = (req: Request, ctx: { params: Promise<{ ref: string }> }) => handle(req, ctx, false);
export const HEAD = (req: Request, ctx: { params: Promise<{ ref: string }> }) => handle(req, ctx, true);
