"use client";

import { createContext, useContext } from "react";

// Requirement Order editor: the lines already on a Purchase Order (line id → PO number). A line row on this list locks itself
// (every field and button disabled) and says which PO it is on; to change it, take it off that PO first.
export const SentLinesContext = createContext<Map<string, string> | null>(null);
export const useSentPo = (lineId: string) => useContext(SentLinesContext)?.get(lineId);
