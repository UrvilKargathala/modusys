import { mockCustomers, type Customer } from "@/lib/mock/pipeline";
import { statusConfig, type StatusKey } from "@/lib/status";
import { mockUsers } from "@/lib/mock/users";
import { months } from "@/lib/constants/months";
import { mockArchitects, fullName, type Architect } from "@/lib/mock/architects";

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(7);

const cityStateMap: Record<string, string> = {
  Mumbai: "Maharashtra",
  Bengaluru: "Karnataka",
  Hyderabad: "Telangana",
  Chennai: "Tamil Nadu",
  Kolkata: "West Bengal",
  Pune: "Maharashtra",
  Delhi: "Delhi",
  Ahmedabad: "Gujarat",
};

// Links to the real Architect entity (lib/mock/architects.ts) by name, plus
// nulls so a chunk of customers deterministically show no architect.
const architectNamePool = [...mockArchitects.map(fullName), null, null, null];

export type CustomerProfile = {
  customerId: string;
  email: string;
  phone: string;
  area: string;
  city: string;
  state: string;
  postcode: string;
  architectName: string | null;
  gst: string;
  birthdayMonth: string;
  birthdayDay: string;
  createdAt: string; // ISO date
  createdById: string;
};

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z]+/g, ".");
}

// Real fields (email/mobile/gst/address/city/state/postcode/birthday) live
// on the DB-backed Customer record now and take priority. The mock/seeded
// fallback only fires for a field a customer has never had set (legacy rows,
// or the lightweight pipeline mock) — architectName/createdAt/createdById
// have no DB column yet, so those stay fully derived.
export function getCustomerProfile(customer: Customer): CustomerProfile {
  const [mockArea, mockCity] = customer.address.split(", ");
  const seed = customer.id.charCodeAt(customer.id.length - 1) + customer.id.length;
  const localRand = mulberry32(seed)();

  const createdDaysAgo = 5 + Math.floor(localRand * 180);
  const createdAt = new Date(Date.now() - createdDaysAgo * 24 * 60 * 60 * 1000).toISOString();

  const city = customer.city || mockCity;
  return {
    customerId: customer.id,
    email: customer.email || `${slug(customer.name)}@gmail.com`,
    phone: customer.mobile || `+91 ${9000000000 + (seed * 137) % 999999999}`.slice(0, 13),
    area: customer.address || mockArea,
    city,
    state: customer.state || cityStateMap[city] || "—",
    postcode: customer.postcode || String(400000 + Math.floor(localRand * 99999)),
    architectName: architectNamePool[seed % architectNamePool.length],
    gst: customer.gst || `27ABCDE${1000 + (seed * 31) % 9000}F1Z${seed % 10}`,
    birthdayMonth: customer.birthdayMonth || months[seed % 12],
    birthdayDay: customer.birthdayDay || String(1 + (seed % 28)),
    createdAt,
    createdById: mockUsers[seed % mockUsers.length].id,
  };
}

export type CustomerQuote = {
  id: string;
  quoteNumber: string;
  date: string;
  status: StatusKey;
  finalOfferLakh: number;
};

// TODO: real cross-reference once the Quotes module (still a placeholder
// page) has actual data — for now, one quote synthesized per customer with
// an offer, linking to the /quotes list page (no detail route exists yet).
export function getCustomerQuotes(customer: Customer): CustomerQuote[] {
  if (customer.finalOfferLakh === null) return [];
  const seed = customer.id.length + customer.name.length;
  const statusPool: StatusKey[] = ["draft", "approved", "in-production", "completed"];
  return [
    {
      id: `quote-${customer.id}`,
      quoteNumber: `Q-${1000 + seed}`,
      date: customer.lastActivity,
      status: statusPool[seed % statusPool.length],
      finalOfferLakh: customer.finalOfferLakh,
    },
  ];
}

export { statusConfig };

// A handful of customers get seeded demo activity/media so both the
// populated and empty states are real, exercised cases — not just designed
// on paper. Everyone else starts with a clean slate.
export const SEEDED_CUSTOMER_IDS = mockCustomers.slice(0, 4).map((c) => c.id);

export type ArchitectLinkedQuote = CustomerQuote & { customerId: string; customerName: string };

// An architect's entire business value is the referred work — matched by
// name against the same architectNamePool every customer profile draws from
// (same TODO as getCustomerQuotes: real cross-reference once Quotes has data).
export function getArchitectLinkedQuotes(architect: Architect): ArchitectLinkedQuote[] {
  const name = fullName(architect);
  return mockCustomers
    .filter((c) => getCustomerProfile(c).architectName === name)
    .flatMap((c) =>
      getCustomerQuotes(c).map((q) => ({ ...q, customerId: c.id, customerName: c.name }))
    );
}
