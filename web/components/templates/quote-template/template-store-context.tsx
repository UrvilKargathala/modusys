"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { quoteTemplateStore, type TemplateStore } from "@/lib/store/quote-template-store";

// The Quote Template and the Purchase Template share the same editor tabs; this says which one they edit.
export const TemplateStoreContext = createContext<TemplateStore>(quoteTemplateStore);

export const useTemplateStore = () => useContext(TemplateStoreContext);

export function useTemplateSettings() {
  const store = useTemplateStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
