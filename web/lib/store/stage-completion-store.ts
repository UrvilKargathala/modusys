"use client";

import { customersStore, useCustomers } from "@/lib/store/customers-store";

// The Pipeline card's "stage done" tick, per (customer, stage). Saved on the customer (`completedStages`, a list of stage
// keys) so everyone — website and phone — sees the same ticks. It used to live in each browser's localStorage only;
// those old browser-only ticks are not carried over.
//
// A tick belongs to one stage: moving the customer on doesn't carry it over, and moving back shows it again.

function stagesOf(customerId: string): string[] {
  return customersStore.getSnapshot().find((c) => c.id === customerId)?.completedStages ?? [];
}

export const stageCompletionStore = {
  isDone(customerId: string, stage: string) {
    return stagesOf(customerId).includes(stage);
  },
  toggle(customerId: string, stage: string) {
    const current = stagesOf(customerId);
    const next = current.includes(stage) ? current.filter((s) => s !== stage) : [...current, stage];
    customersStore.updateCustomer(customerId, { completedStages: next });
  },
};

export function useIsStageDone(customerId: string, stage: string): boolean {
  const customers = useCustomers();
  return (customers.find((c) => c.id === customerId)?.completedStages ?? []).includes(stage);
}
