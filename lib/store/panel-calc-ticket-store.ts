"use client";

import { useSyncExternalStore } from "react";
import { fetchJson } from "@/lib/store/api-sync";
import type { FurnitureLineItem } from "@/lib/mock/unit-type";

// Panel Calculator tickets (shared for everyone, latest 5 kept by the server). Unlike the whole-list stores, each Save and
// Delete is its own request, so two people saving at once don't overwrite each other.
export type PanelCalcTicket = { id: string; no: number; rows: FurnitureLineItem[]; createdBy: string; createdAt: string };

let tickets: PanelCalcTicket[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const empty: PanelCalcTicket[] = [];

function emit() {
  for (const listener of listeners) listener();
}

async function refresh() {
  const data = await fetchJson<PanelCalcTicket[]>("/api/panel-calc-tickets");
  if (data) {
    tickets = data;
    emit();
  }
}

export const panelCalcTicketStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    if (!hydrated && typeof window !== "undefined") {
      hydrated = true;
      void refresh();
    }
    return tickets;
  },
  getServerSnapshot() {
    return empty;
  },
  refresh,
  // Returns the saved ticket, or null when the save failed.
  async save(rows: FurnitureLineItem[]): Promise<PanelCalcTicket | null> {
    try {
      const res = await fetch("/api/panel-calc-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) return null;
      const ticket = (await res.json()) as PanelCalcTicket;
      await refresh();
      return ticket;
    } catch {
      return null;
    }
  },
  async remove(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/panel-calc-tickets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) await refresh();
      return res.ok;
    } catch {
      return false;
    }
  },
};

export function usePanelCalcTickets() {
  return useSyncExternalStore(panelCalcTicketStore.subscribe, panelCalcTicketStore.getSnapshot, panelCalcTicketStore.getServerSnapshot);
}

// "30/10/2026, 14:05"
export const ticketTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
