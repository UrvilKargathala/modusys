"use client";

import { useSyncExternalStore } from "react";
import { mockQuoteTemplateSettings, type QuoteTemplateSettings } from "@/lib/mock/quote-template";
import { fetchJson, makeDebouncedPut } from "@/lib/store/api-sync";

// Singleton config row backed by the shared DB via /api/quote-template.
// Every mutation funnels through persist(), a debounced PUT of the whole
// settings object.
let settings: QuoteTemplateSettings = mockQuoteTemplateSettings;
let hydrated = false;
const listeners = new Set<() => void>();

const putSettings = makeDebouncedPut("/api/quote-template");
function persist() {
  putSettings(settings);
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void fetchJson<QuoteTemplateSettings>("/api/quote-template").then((data) => {
    if (data) {
      settings = data;
      emit();
    }
  });
}

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// TODO: replace with real GET/PATCH /quote-template calls (Phase B backend).
export const quoteTemplateStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return settings;
  },
  getServerSnapshot() {
    return mockQuoteTemplateSettings;
  },
  updateLayout(fields: Partial<QuoteTemplateSettings["layout"]>) {
    ensureHydrated();
    settings = { ...settings, layout: { ...settings.layout, ...fields } };
    persist();
    emit();
  },
  updateBranding(fields: Partial<QuoteTemplateSettings["branding"]>) {
    ensureHydrated();
    settings = { ...settings, branding: { ...settings.branding, ...fields } };
    persist();
    emit();
  },
  updateBanking(fields: Partial<QuoteTemplateSettings["banking"]>) {
    ensureHydrated();
    settings = { ...settings, banking: { ...settings.banking, ...fields } };
    persist();
    emit();
  },
  updateSignature(fields: Partial<QuoteTemplateSettings["signature"]>) {
    ensureHydrated();
    settings = { ...settings, signature: { ...settings.signature, ...fields } };
    persist();
    emit();
  },
  addNote(text: string) {
    ensureHydrated();
    settings = { ...settings, notes: [...settings.notes, { id: `note-${Date.now()}`, text }] };
    persist();
    emit();
  },
  updateNote(id: string, text: string) {
    ensureHydrated();
    settings = { ...settings, notes: settings.notes.map((n) => (n.id === id ? { ...n, text } : n)) };
    persist();
    emit();
  },
  removeNote(id: string) {
    ensureHydrated();
    settings = { ...settings, notes: settings.notes.filter((n) => n.id !== id) };
    persist();
    emit();
  },
  moveNote(index: number, direction: -1 | 1) {
    ensureHydrated();
    settings = { ...settings, notes: moveItem(settings.notes, index, direction) };
    persist();
    emit();
  },
  addTerm(text: string) {
    ensureHydrated();
    settings = { ...settings, terms: [...settings.terms, { id: `term-${Date.now()}`, text }] };
    persist();
    emit();
  },
  updateTerm(id: string, text: string) {
    ensureHydrated();
    settings = { ...settings, terms: settings.terms.map((t) => (t.id === id ? { ...t, text } : t)) };
    persist();
    emit();
  },
  removeTerm(id: string) {
    ensureHydrated();
    settings = { ...settings, terms: settings.terms.filter((t) => t.id !== id) };
    persist();
    emit();
  },
  moveTerm(index: number, direction: -1 | 1) {
    ensureHydrated();
    settings = { ...settings, terms: moveItem(settings.terms, index, direction) };
    persist();
    emit();
  },
  addPaymentTerm(text: string) {
    ensureHydrated();
    settings = { ...settings, paymentTerms: [...settings.paymentTerms, { id: `pay-${Date.now()}`, text }] };
    persist();
    emit();
  },
  updatePaymentTerm(id: string, text: string) {
    ensureHydrated();
    settings = { ...settings, paymentTerms: settings.paymentTerms.map((t) => (t.id === id ? { ...t, text } : t)) };
    persist();
    emit();
  },
  removePaymentTerm(id: string) {
    ensureHydrated();
    settings = { ...settings, paymentTerms: settings.paymentTerms.filter((t) => t.id !== id) };
    persist();
    emit();
  },
  movePaymentTerm(index: number, direction: -1 | 1) {
    ensureHydrated();
    settings = { ...settings, paymentTerms: moveItem(settings.paymentTerms, index, direction) };
    persist();
    emit();
  },
};

export function useQuoteTemplateSettings() {
  return useSyncExternalStore(
    quoteTemplateStore.subscribe,
    quoteTemplateStore.getSnapshot,
    quoteTemplateStore.getServerSnapshot
  );
}
