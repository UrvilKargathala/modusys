import { pipelineStages, type PipelineStageKey } from "@/lib/constants/pipelineStages";

export type Customer = {
  id: string;
  name: string;
  prefix: string;
  firstName: string;
  lastName: string;
  srNo: number;
  customerCode: string;
  birthdayYear: string;
  // Profile fields — present on serialized DB records (merged Customer table),
  // absent on the lightweight pipeline mock, hence optional.
  mobile?: string;
  email?: string;
  gst?: string;
  city?: string;
  state?: string;
  postcode?: string;
  birthdayMonth?: string;
  birthdayDay?: string;
  address: string;
  companyName?: string;
  stage: PipelineStageKey;
  finalOfferLakh: number | null;
  assignee: string;
  lastActivity: string; // ISO date
  daysInStage: number;
};

// Deterministic PRNG so mock data is stable across renders/reloads instead
// of reshuffling every time (mulberry32 — small, no dependency needed).
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

const rand = mulberry32(42);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const surnames = [
  "Sharma", "Verma", "Kapoor", "Iyer", "Nair", "Menon", "Reddy", "Rao",
  "Gupta", "Malhotra", "Chatterjee", "Bose", "Desai", "Shah", "Patel",
  "Agarwal", "Singh", "Joshi", "Mehta", "Pillai",
];
const clientSuffix = ["Residence", "Interiors", "Apartment", "Villa", "Home"];
const cities = [
  "Bandra West, Mumbai", "Koramangala, Bengaluru", "Jubilee Hills, Hyderabad",
  "Anna Nagar, Chennai", "Salt Lake, Kolkata", "Baner, Pune",
  "Vasant Kunj, Delhi", "Satellite, Ahmedabad", "Indiranagar, Bengaluru",
  "Powai, Mumbai",
];
export const assignees = ["Priya Nair", "Rahul Verma", "Ananya Iyer", "Vikram Singh", "Karan Mehta"];

// 74 customers total across 13 stages — matches the audit volume noted in
// PHASES.md (Phase B0 seed script). Ready To Dispatch and Services are
// intentionally 0 so the List view's "zero-count stages default collapsed"
// rule has a real case to exercise, not a hypothetical.
const stageCounts: Record<PipelineStageKey, number> = {
  "upcoming-inquiry": 9,
  "inquiry-in-process": 7,
  design: 5,
  quotation: 32,
  "onsite-measurements": 3,
  "onsite-marking": 2,
  production: 4,
  "material-requirement-slip": 2,
  "ready-to-dispatch": 0,
  installation: 1,
  services: 0,
  "site-completed": 6,
  "cancel-order": 3,
};

// A quote exists from Quotation onward — earlier stages (inquiry, design)
// haven't produced a final offer yet.
const stagesWithOffers = new Set<PipelineStageKey>([
  "quotation", "onsite-measurements", "onsite-marking", "production",
  "material-requirement-slip", "ready-to-dispatch", "installation",
  "services", "site-completed", "cancel-order",
]);

function generateCustomers(): Customer[] {
  const customers: Customer[] = [];
  let counter = 1;

  for (const stage of pipelineStages) {
    const count = stageCounts[stage.key];
    for (let i = 0; i < count; i++) {
      const seq = counter;
      const id = `cust-${counter++}`;
      const cname = `${pick(surnames)} ${pick(clientSuffix)}`;
      const [cfirst, ...crest] = cname.split(" ");
      customers.push({
        id,
        name: cname,
        prefix: "",
        firstName: cfirst,
        lastName: crest.join(" "),
        srNo: seq,
        customerCode: `${cfirst[0] ?? ""}${(crest[0] ?? "")[0] ?? ""}`.toUpperCase(),
        birthdayYear: "",
        address: pick(cities),
        stage: stage.key,
        finalOfferLakh: stagesWithOffers.has(stage.key)
          ? Math.round((1.5 + rand() * 10.5) * 10) / 10
          : null,
        assignee: pick(assignees),
        lastActivity: new Date(Date.now() - Math.floor(rand() * 30) * 86400000).toISOString(),
        daysInStage: Math.floor(rand() * 45),
      });
    }
  }

  return customers;
}

// Generated once at module load — stable identity across re-renders so
// drag-and-drop and sort state don't fight a reshuffling data source.
export const mockCustomers: Customer[] = generateCustomers();

export function getPipelineCustomers(): Customer[] {
  return mockCustomers;
}

export type CustomerSortOption = "offer-value" | "days-in-stage" | "last-activity";

export const customerSortOptions: { label: string; value: CustomerSortOption }[] = [
  { label: "Offer value", value: "offer-value" },
  { label: "Days in stage", value: "days-in-stage" },
  { label: "Last activity", value: "last-activity" },
];

export function sortCustomers(customers: Customer[], sort: CustomerSortOption): Customer[] {
  const sorted = [...customers];
  switch (sort) {
    case "offer-value":
      return sorted.sort((a, b) => (b.finalOfferLakh ?? 0) - (a.finalOfferLakh ?? 0));
    case "days-in-stage":
      return sorted.sort((a, b) => b.daysInStage - a.daysInStage);
    case "last-activity":
      return sorted.sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
  }
}

// TODO: replace with a real PATCH /customers/:id/stage call (Phase B2).
// Simulates network latency and an occasional failure so the Kanban's
// optimistic-update/rollback path is actually exercised, not just wired.
export async function updateCustomerStage(
  customerId: string,
  nextStage: PipelineStageKey
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const customer = mockCustomers.find((c) => c.id === customerId);
  if (!customer) throw new Error("Customer not found");

  // ~10% simulated failure rate to exercise rollback.
  if (rand() < 0.1) {
    throw new Error("Failed to move customer — please try again.");
  }

  customer.stage = nextStage;
}
