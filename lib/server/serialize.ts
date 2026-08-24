import "server-only";
import type { Customer, Architect, User, ArchitectPartner, Message, MediaAttachment, MessageReaction } from "@prisma/client";
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

export function serializeMessage(m: MessageWithReactions, currentUserId: string) {
  return {
    id: m.id,
    customerId: m.customerId,
    kind: m.kind,
    senderId: m.senderId,
    text: m.text ?? undefined,
    mentionedUserIds: m.mentionedUserIds,
    audioUrl: m.audioUrl ?? undefined,
    durationSec: m.durationSec ?? undefined,
    imageUrl: m.imageUrl ?? undefined,
    imageName: m.imageName ?? undefined,
    imageUrls: m.imageUrls,
    imageNames: m.imageNames,
    pdfUrl: m.pdfUrl ?? undefined,
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
    url: m.url,
    sizeBytes: m.sizeBytes,
    durationSec: m.durationSec ?? undefined,
    uploadedAt: m.uploadedAt.toISOString(),
    status: "done" as const,
  };
}
