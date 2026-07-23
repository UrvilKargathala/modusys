export type Architect = {
  id: string;
  prefix: string; // "", "Mr", "Mrs", "Ms", "Dr"
  firstName: string;
  lastName: string;
  partners: string[];
  mobile: string;
  office: string;
  company: string;
  instagram: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  birthdayMonth: string;
  birthdayDay: string;
  birthdayYear: string;
  createdAt: string; // ISO date
  createdById: string;
  deleted?: boolean;
};

export function fullName(a: Pick<Architect, "firstName" | "lastName"> & { prefix?: string }) {
  return `${a.prefix ? `${a.prefix} ` : ""}${a.firstName} ${a.lastName}`.trim();
}

// Seed data — intentionally includes a near-duplicate pair ("Ar Swapnil"
// entered twice under slightly different companies) since the real org data
// already has repeats like this; it's what the duplicate-flagging feature in
// the table is meant to catch.
export const mockArchitects: Architect[] = [
  {
    id: "arch-1",
    prefix: "Mr",
    firstName: "Ar Swapnil",
    lastName: "Deshmukh",
    partners: [],
    mobile: "+91 9820011223",
    office: "+91 2226501122",
    company: "Deshmukh Design Studio",
    instagram: "@swapnil.designs",
    address: "Prabhadevi",
    city: "Mumbai",
    state: "Maharashtra",
    postcode: "400025",
    birthdayMonth: "March",
    birthdayDay: "14",
    birthdayYear: "",
    createdAt: "2026-02-10T09:00:00Z",
    createdById: "u1",
  },
  {
    id: "arch-2",
    prefix: "Mr",
    firstName: "Ar Swapnil",
    lastName: "Deshmukh",
    partners: ["Ar. Priya Kulkarni"],
    mobile: "+91 9820011224",
    office: "",
    company: "SD Architects",
    instagram: "@sd.architects",
    address: "Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    postcode: "400050",
    birthdayMonth: "March",
    birthdayDay: "14",
    birthdayYear: "",
    createdAt: "2026-03-02T09:00:00Z",
    createdById: "u1",
  },
  {
    id: "arch-3",
    prefix: "Mrs",
    firstName: "Kavita",
    lastName: "Rao",
    partners: [],
    mobile: "+91 9845012233",
    office: "+91 8041123344",
    company: "Rao & Associates",
    instagram: "@kavitarao.studio",
    address: "Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    postcode: "560038",
    birthdayMonth: "July",
    birthdayDay: "22",
    birthdayYear: "",
    createdAt: "2026-01-20T09:00:00Z",
    createdById: "u5",
  },
  {
    id: "arch-4",
    prefix: "Mr",
    firstName: "Suresh",
    lastName: "Iyer",
    partners: ["Ar. Meena Pillai", "Ar. Ravi Nair"],
    mobile: "+91 9884455667",
    office: "",
    company: "Iyer Design Co.",
    instagram: "@iyer.design",
    address: "Anna Nagar",
    city: "Chennai",
    state: "Tamil Nadu",
    postcode: "600040",
    birthdayMonth: "November",
    birthdayDay: "5",
    birthdayYear: "",
    createdAt: "2025-12-15T09:00:00Z",
    createdById: "u1",
  },
  {
    id: "arch-5",
    prefix: "Mrs",
    firstName: "Meenal",
    lastName: "Deshpande",
    partners: [],
    mobile: "+91 9765432109",
    office: "+91 2025223344",
    company: "Deshpande Interiors",
    instagram: "@meenal.interiors",
    address: "Koregaon Park",
    city: "Pune",
    state: "Maharashtra",
    postcode: "411001",
    birthdayMonth: "September",
    birthdayDay: "30",
    birthdayYear: "",
    createdAt: "2026-04-01T09:00:00Z",
    createdById: "u6",
  },
];

export function getArchitects(): Architect[] {
  return mockArchitects;
}
