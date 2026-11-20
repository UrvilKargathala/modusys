// How the CRM pipeline orders customers in a column or list section. Shared by the website's Kanban / List and the
// phone's CRM board, so both show the same order. Plain TypeScript, no packages.

export type CustomerSortOption = "offer-value" | "days-in-stage" | "last-activity";

export const customerSortOptions: { label: string; value: CustomerSortOption }[] = [
  { label: "Offer value", value: "offer-value" },
  { label: "Days in stage", value: "days-in-stage" },
  { label: "Last activity", value: "last-activity" },
];

/** Highest offer, longest in stage, or most recent activity first. Returns a new array. */
export function sortCustomers<T extends { finalOfferLakh: number | null; daysInStage: number; lastActivity: string }>(customers: T[], sort: CustomerSortOption): T[] {
  const sorted = [...customers];
  switch (sort) {
    case "offer-value":
      return sorted.sort((a, b) => (b.finalOfferLakh ?? 0) - (a.finalOfferLakh ?? 0));
    case "days-in-stage":
      return sorted.sort((a, b) => b.daysInStage - a.daysInStage);
    case "last-activity":
      return sorted.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }
}
