import "server-only";
import { prisma } from "./prisma";
import { fullName } from "@shared/mock/architects";

const MAX_RESULTS = 5; // as the website's search (web/components/layout/global-search.tsx)

export type SearchResults = {
  customers: { id: string; name: string; address: string }[];
  architects: { id: string; name: string; company: string }[];
  /** Admin and super admin only (the roles that see Quotes on the website); a result opens its customer on the phone. */
  quotes: { id: string; quoteNumber: string; customerId: string | null; customerName: string }[];
};

/**
 * The website's Ctrl/Cmd+K search for the phone, with the same matches: customers by name or address, architects by
 * full name or company, quotes by number or customer name; up to 5 of each.
 */
export async function mobileSearch(query: string, withQuotes: boolean): Promise<SearchResults> {
  const q = query.trim().toLowerCase();
  if (!q) return { customers: [], architects: [], quotes: [] };
  const [customers, architects, quotes] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, select: { id: true, name: true, address: true }, orderBy: { createdAt: "desc" } }),
    prisma.architect.findMany({ select: { id: true, prefix: true, firstName: true, lastName: true, company: true }, orderBy: { createdAt: "desc" } }),
    withQuotes ? prisma.quote.findMany({ select: { id: true, quoteNumber: true, customerId: true }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  const customerName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.name ?? "" : "");
  return {
    customers: customers.filter((c) => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)).slice(0, MAX_RESULTS),
    architects: architects
      .filter((a) => fullName(a).toLowerCase().includes(q) || a.company.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS)
      .map((a) => ({ id: a.id, name: fullName(a), company: a.company })),
    quotes: quotes
      .filter((x) => x.quoteNumber.toLowerCase().includes(q) || customerName(x.customerId).toLowerCase().includes(q))
      .slice(0, MAX_RESULTS)
      .map((x) => ({ ...x, customerName: customerName(x.customerId) })),
  };
}
