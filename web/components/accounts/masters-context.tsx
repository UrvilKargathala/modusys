"use client";

import { createContext, useContext } from "react";
import type { Masters } from "@backend/server/accounts-data";

// Heads, payment accounts, payment modes and parties, loaded once by the Accounts layout for every entry form on the page.
const MastersContext = createContext<Masters>({ heads: [], accounts: [], modes: [], parties: [] });

export function MastersProvider({ masters, children }: { masters: Masters; children: React.ReactNode }) {
  return <MastersContext.Provider value={masters}>{children}</MastersContext.Provider>;
}

export const useMasters = () => useContext(MastersContext);
