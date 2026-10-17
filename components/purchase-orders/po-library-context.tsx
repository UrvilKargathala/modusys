"use client";

import { createContext, useContext } from "react";
import type { MaterialCategoryKey } from "@/lib/mock/material-spec";

// Which library the dropdowns on a purchase order read: the Purchase Material Library, or (on a Proforma Invoice) the Proforma Library,
// which has the same lists with its own data.
export const PoLibraryContext = createContext<"purchase" | "proforma">("purchase");

export const libKey = (lib: "purchase" | "proforma", key: MaterialCategoryKey): MaterialCategoryKey =>
  lib === "proforma" ? (key.replace(/^purchase-/, "proforma-") as MaterialCategoryKey) : key;

export const useLibKey = (key: MaterialCategoryKey) => libKey(useContext(PoLibraryContext), key);
