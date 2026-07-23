import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { mockCustomers } from "../lib/mock/pipeline";
import { getCustomerProfile } from "../lib/mock/customer-detail";
import { mockArchitects } from "../lib/mock/architects";
import { mockUsers } from "../lib/mock/users";
import { mockMaterialItems } from "../lib/mock/material-spec";
import { mockFurniturePriceItems, mockHardwarePriceItems } from "../lib/mock/pricing-list";
import { mockCabinetTypes } from "../lib/mock/cabinet-type";
import { mockUnitTypes } from "../lib/mock/unit-type";
import { mockQuoteTemplateSettings } from "../lib/mock/quote-template";

// Seeds Batch-1 tables with the exact mock data the app already renders, so
// the migration doesn't leave an empty shell. Idempotent: clears the three
// tables first, then re-inserts. Preserves the app's original string ids
// (u1.., arch-1.., cust-1..) so any references stay stable.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Clearing Batch-1 tables…");
  await prisma.architectPartner.deleteMany();
  await prisma.architect.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  console.log(`Seeding ${mockUsers.length} users…`);
  await prisma.user.createMany({
    data: mockUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      mustChangePassword: u.mustChangePassword ?? false,
      passwordUpdatedAt: u.passwordUpdatedAt ? new Date(u.passwordUpdatedAt) : null,
      lastActive: new Date(u.lastActive),
    })),
  });

  console.log(`Seeding ${mockCustomers.length} customers…`);
  await prisma.customer.createMany({
    data: mockCustomers.map((c) => {
      const p = getCustomerProfile(c);
      return {
        id: c.id,
        name: c.name,
        prefix: c.prefix,
        firstName: c.firstName,
        lastName: c.lastName,
        srNo: c.srNo,
        customerCode: c.customerCode,
        mobile: p.phone,
        email: p.email,
        gst: p.gst,
        address: c.address,
        city: p.city,
        state: p.state,
        postcode: p.postcode,
        birthdayMonth: p.birthdayMonth,
        birthdayDay: p.birthdayDay,
        birthdayYear: c.birthdayYear,
        stage: c.stage,
        finalOfferLakh: c.finalOfferLakh,
        assignee: c.assignee,
        daysInStage: c.daysInStage,
        lastActivity: new Date(c.lastActivity),
        createdById: p.createdById,
        createdAt: new Date(p.createdAt),
      };
    }),
  });

  const liveArchitects = mockArchitects.filter((a) => !a.deleted);
  console.log(`Seeding ${liveArchitects.length} architects…`);
  for (const a of liveArchitects) {
    await prisma.architect.create({
      data: {
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
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
        createdById: a.createdById,
        createdAt: new Date(a.createdAt),
        partners: { create: a.partners.map((name) => ({ name })) },
      },
    });
  }


  console.log("Clearing Batch-2 tables…");
  await prisma.quote.deleteMany();
  await prisma.materialItem.deleteMany();
  await prisma.furniturePriceItem.deleteMany();
  await prisma.hardwarePriceItem.deleteMany();
  await prisma.cabinetType.deleteMany();
  await prisma.unitType.deleteMany();
  await prisma.quoteTemplateSettings.deleteMany();

  console.log(`Seeding ${mockMaterialItems.length} material items…`);
  await prisma.materialItem.createMany({
    data: mockMaterialItems.map((m) => ({
      id: m.id, category: m.category, name: m.name, description: m.description ?? "",
    })),
  });

  console.log(`Seeding ${mockFurniturePriceItems.length} furniture price items…`);
  await prisma.furniturePriceItem.createMany({
    data: mockFurniturePriceItems.map((f) => ({
      id: f.id, thicknessId: f.thicknessId, rawMaterialTypeId: f.rawMaterialTypeId,
      internalColourId: f.internalColourId, externalColourId: f.externalColourId,
      rate: f.rate, deleted: f.deleted ?? false, createdAt: new Date(f.createdAt),
    })),
  });

  console.log(`Seeding ${mockHardwarePriceItems.length} hardware price items…`);
  await prisma.hardwarePriceItem.createMany({
    data: mockHardwarePriceItems.map((h) => ({
      id: h.id, articleNo: h.articleNo, categoryId: h.categoryId, brandId: h.brandId,
      unitId: h.unitId, description: h.description ?? "", mrp: h.mrp, discountPct: h.discountPct,
      deleted: h.deleted ?? false, createdAt: new Date(h.createdAt),
    })),
  });

  console.log(`Seeding ${mockCabinetTypes.length} cabinet types…`);
  await prisma.cabinetType.createMany({
    data: mockCabinetTypes.map((c) => ({
      id: c.id, name: c.name, shortCode: c.shortCode, active: c.active,
      brandId: c.brandId, description: c.description ?? "",
      components: c.components as object[], deleted: c.deleted ?? false,
      createdAt: new Date(c.createdAt),
    })),
  });

  console.log(`Seeding ${mockUnitTypes.length} unit types…`);
  await prisma.unitType.createMany({
    data: mockUnitTypes.map((u) => ({
      id: u.id, name: u.name, shortCode: u.shortCode, active: u.active,
      cabinetTypeLinks: u.cabinetTypeLinks as object[],
      components: u.components as object[], externalFinishes: u.externalFinishes as object[],
      otherPanels: u.otherPanels as object[], hardware: u.hardware as object[],
      deleted: u.deleted ?? false, createdAt: new Date(u.createdAt),
    })),
  });

  console.log("Seeding QuoteTemplateSettings (singleton)…");
  const s = mockQuoteTemplateSettings;
  await prisma.quoteTemplateSettings.create({
    data: {
      id: "singleton",
      layout: s.layout as object, branding: s.branding as object,
      banking: s.banking as object, signature: s.signature as object,
      notes: s.notes as object[], terms: s.terms as object[], paymentTerms: s.paymentTerms as object[],
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
