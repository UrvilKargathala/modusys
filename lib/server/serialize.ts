import "server-only";
import { createHash } from "crypto";
import type { Customer, Architect, User, ArchitectPartner, Message, MediaAttachment, MessageReaction, Vendor, PurchaseOrder, PurchaseOrderLine } from "@prisma/client";
import type { VendorContact, PoGroup, GstMode, PoMaterial, PoStatus } from "@/lib/purchase-order";
import type { ArchitectSiteEngineer } from "@/lib/mock/architects";

// DB rows carry Date objects and a merged/relational shape; the existing app
// types expect ISO strings, partners as string[], and soft-delete as a bool.
// These map DB rows to the shapes the client stores already consume.

export function serializeUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    role: u.role,
    lastActive: u.lastActive.toISOString(),
    mustChangePassword: u.mustChangePassword,
    passwordUpdatedAt: u.passwordUpdatedAt?.toISOString(),
  };
}

export function serializeArchitect(a: Architect & { partners: ArchitectPartner[] }) {
  return {
    id: a.id,
    prefix: a.prefix,
    firstName: a.firstName,
    lastName: a.lastName,
    partners: a.partners.map((p) => ({ id: p.id, prefix: p.prefix, firstName: p.firstName, lastName: p.lastName, mobile: p.mobile })),
    siteEngineers: (a.siteEngineers as ArchitectSiteEngineer[] | null) ?? [],
    mobile: a.mobile,
    office: a.office,
    company: a.company,
    instagram: a.instagram,
    address: a.address,
    city: a.city,
    state: a.state,
    postcode: a.postcode,
    birthdayMonth: a.birthdayMonth,
    birthdayDay: a.birthdayDay,
    birthdayYear: a.birthdayYear,
    createdAt: a.createdAt.toISOString(),
    createdById: a.createdById ?? "",
    deleted: a.deletedAt !== null,
  };
}

export function serializeCustomer(c: Customer) {
  return {
    id: c.id,
    name: c.name,
    prefix: c.prefix,
    firstName: c.firstName,
    lastName: c.lastName,
    srNo: c.srNo,
    customerCode: c.customerCode,
    birthdayYear: c.birthdayYear,
    address: c.address,
    stage: c.stage,
    finalOfferLakh: c.finalOfferLakh,
    assignee: c.assignee,
    lastActivity: c.lastActivity.toISOString(),
    daysInStage: c.daysInStage,
    // merged profile fields
    mobile: c.mobile,
    email: c.email,
    gst: c.gst,
    city: c.city,
    state: c.state,
    postcode: c.postcode,
    birthdayMonth: c.birthdayMonth,
    birthdayDay: c.birthdayDay,
    architectId: c.architectId ?? "",
    siteManagerId: c.siteManagerId ?? "",
    createdById: c.createdById ?? "",
    createdAt: c.createdAt.toISOString(),
  };
}

export type MessageWithReactions = Message & { reactions?: MessageReaction[] };

// Groups raw MessageReaction rows into { emoji, count, reactedByMe, userIds }
// per emoji — the shape the bubble renders directly, no client-side grouping.
function groupReactions(reactions: MessageReaction[] | undefined, currentUserId: string) {
  if (!reactions || reactions.length === 0) return [];
  const byEmoji = new Map<string, string[]>();
  for (const r of reactions) {
    const list = byEmoji.get(r.emoji) ?? [];
    list.push(r.userId);
    byEmoji.set(r.emoji, list);
  }
  return [...byEmoji.entries()].map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    reactedByMe: userIds.includes(currentUserId),
    userIds,
  }));
}

type PhotoCols = {
  id: string;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  checkInPhotoKey: string | null;
  checkOutPhotoKey: string | null;
};

// Attendance rows carry a storage key (new) and a legacy Blob URL (old, kept for rollback).
// The browser must see neither: it only needs to know whether a photo exists, and it renders
// the photo through /api/files/att_<id>. So the *PhotoUrl fields become broker addresses (or
// null) and the raw key columns are dropped.
export function withAttendancePhotos<T extends PhotoCols>(r: T) {
  return {
    ...r,
    checkInPhotoUrl: r.checkInPhotoKey ? `/api/files/att_${r.id}?side=checkIn` : null,
    checkOutPhotoUrl: r.checkOutPhotoKey ? `/api/files/att_${r.id}?side=checkOut` : null,
    checkInPhotoKey: undefined,
    checkOutPhotoKey: undefined,
  };
}

// Files live in a private Garage bucket. The browser never sees a storage URL — it gets a
// permanent, login-gated address on our own app (see app/api/files/[ref]/route.ts).
// Images are addressed by position, and positions shift when one is removed, so the address
// carries a short hash of the key (`v`, ignored by the broker) to keep the 1h browser cache honest.
const messageImageUrl = (id: string, key: string, i: number) =>
  `/api/files/msg_${id}?i=${i}&v=${createHash("sha1").update(key).digest("hex").slice(0, 8)}`;

export function serializeMessage(m: MessageWithReactions, currentUserId: string) {
  const imageUrls = m.imageKeys.map((key, i) => messageImageUrl(m.id, key, i));
  return {
    id: m.id,
    customerId: m.customerId,
    kind: m.kind,
    senderId: m.senderId,
    text: m.text ?? undefined,
    mentionedUserIds: m.mentionedUserIds,
    audioUrl: m.audioKey ? `/api/files/msg_${m.id}` : undefined,
    durationSec: m.durationSec ?? undefined,
    imageUrl: imageUrls[0],
    imageName: m.imageName ?? undefined,
    imageUrls,
    imageNames: m.imageNames,
    pdfUrl: m.pdfKey ? `/api/files/msg_${m.id}` : undefined,
    pdfName: m.pdfName ?? undefined,
    pdfSize: m.pdfSize ?? undefined,
    replyToMessageId: m.replyToMessageId ?? undefined,
    replyToImageIndex: m.replyToImageIndex ?? undefined,
    starred: m.starredBy.includes(currentUserId),
    isForwarded: !!m.forwardedFromId,
    reactions: groupReactions(m.reactions, currentUserId),
    editedAt: m.editedAt?.toISOString(),
    createdAt: m.createdAt.toISOString(),
    status: "sent" as const,
  };
}

export function serializeMediaAttachment(m: MediaAttachment) {
  return {
    id: m.id,
    customerId: m.customerId,
    type: m.type as "image" | "video" | "document",
    name: m.name,
    url: `/api/files/media_${m.id}`,
    sizeBytes: m.sizeBytes,
    durationSec: m.durationSec ?? undefined,
    uploadedAt: m.uploadedAt.toISOString(),
    status: "done" as const,
  };
}

export function serializeVendor(v: Vendor) {
  return {
    id: v.id,
    name: v.name,
    address: v.address,
    city: v.city,
    state: v.state,
    gst: v.gst,
    code: v.code,
    contacts: (v.contacts as VendorContact[] | null) ?? [],
    emails: (v.emails as string[] | null) ?? [],
    createdAt: v.createdAt.toISOString(),
  };
}

export function serializePurchaseOrder(po: PurchaseOrder & { lines: PurchaseOrderLine[] }, vendorName = "") {
  return {
    id: po.id,
    poNumber: po.poNumber,
    poDate: po.poDate,
    requiredDate: po.requiredDate,
    vendorId: po.vendorId,
    vendorName,
    quoteId: po.quoteId,
    customerId: po.customerId,
    discountPct: po.discountPct,
    material: { shutterRawMaterial: "", otherRawMaterial: "", cabinetRawMaterial: "", cabinetOtherRawMaterial: "", internalColours: [], externalColours: [], cabinets: {}, ...((po.material as Partial<PoMaterial> | null) ?? {}) },
    gstMode: po.gstMode as GstMode,
    status: (po.status === "completed" ? "completed" : "pending") as PoStatus,
    roundOff: po.roundOff,
    remarks: po.remarks,
    createdAt: po.createdAt.toISOString(),
    lines: [...po.lines]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        id: l.id,
        group: l.group as PoGroup,
        srNo: l.srNo,
        position: l.position,
        description: l.description,
        designType: l.designType,
        width: l.width,
        depth: l.depth,
        height: l.height,
        qty: l.qty,
        sqft: l.sqft,
        internalColour: l.internalColour,
        externalColour: l.externalColour,
        material: l.material,
        articleNo: l.articleNo,
        brand: l.brand,
        category: l.category,
        unit: l.unit,
        rate: l.rate,
        discountPct: l.discountPct,
        remarks: l.remarks,
        vendorId: l.vendorId,
      })),
  };
}
