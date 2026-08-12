import "server-only";
import type { Customer, Architect, User, ArchitectPartner, Message } from "@prisma/client";

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
    partners: a.partners.map((p) => ({ id: p.id, prefix: p.prefix, firstName: p.firstName, lastName: p.lastName })),
    siteEngineers: (a.siteEngineers as string[] | null) ?? [],
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
    createdById: c.createdById ?? "",
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializeMessage(m: Message) {
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
    pdfUrl: m.pdfUrl ?? undefined,
    pdfName: m.pdfName ?? undefined,
    pdfSize: m.pdfSize ?? undefined,
    editedAt: m.editedAt?.toISOString(),
    createdAt: m.createdAt.toISOString(),
    status: "sent" as const,
  };
}
