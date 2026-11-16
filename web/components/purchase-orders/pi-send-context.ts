"use client";

import { createContext } from "react";

// Own factory, Purchase Order (Send to PI) or Proforma Invoice (Send to Work Order) editor: every line table gets a tick box per line.
// Lines already sent (sent: line key → where, e.g. the PI number or "the Work Order") are locked and say where they are; filter shows
// All / Pending / Sent lines. takeOff: a locked line can be taken back here (the Work Order); without it, it's taken off at the other end.
export type PiSend = {
  sent: Map<string, string>;
  picked: Set<string>;
  pick: (keys: string[], on: boolean) => void;
  filter: "all" | "pending" | "sent";
  takeOff?: (key: string) => void;
};
export const PiSendContext = createContext<PiSend | null>(null);
