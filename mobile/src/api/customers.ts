// Customers (CRM): the same endpoints the web's CRM and Customer Master use.
import type { CustomStageRow } from '../lib/stages';
import { api } from './client';

/** One customer as /api/customers sends it (backend/server/serialize.ts serializeCustomer). */
export type Customer = {
  id: string;
  name: string;
  prefix: string;
  firstName: string;
  lastName: string;
  srNo: number;
  customerCode: string;
  address: string;
  stage: string;
  finalOfferLakh: number | null;
  assignee: string;
  lastActivity: string;
  daysInStage: number;
  mobile: string;
  email: string;
  gst: string;
  city: string;
  state: string;
  postcode: string;
  birthdayMonth: string;
  birthdayDay: string;
  birthdayYear: string;
  architectId: string;
  /** Stage keys ticked "done" (the website's Pipeline card tick), shared with the website. */
  completedStages?: string[];
  siteManagerId: string;
  createdById: string;
  createdAt: string;
};

export type Architect = {
  id: string;
  prefix: string;
  firstName: string;
  lastName: string;
  company?: string;
  mobile?: string;
  office?: string;
  instagram?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  birthdayMonth?: string;
  birthdayDay?: string;
  birthdayYear?: string;
};
export type OrgUser = { id: string; name: string; status: string; role: string };

/** Every customer, newest first (the web lists them all too). Search and stage filters run on the phone. */
export function listCustomers() {
  return api<Customer[]>('/api/customers');
}

export function getCustomer(id: string) {
  return api<Customer>(`/api/customers/${encodeURIComponent(id)}`);
}

/** Custom stages added on the web (Admin > Pipeline stages). */
export function listCustomStages() {
  return api<{ stages: CustomStageRow[] }>('/api/pipeline-stages');
}

export function listArchitects() {
  return api<Architect[]>('/api/architects');
}

/** For the site manager's name. */
export function listUsers() {
  return api<OrgUser[]>('/api/users');
}

/** The fields the Add / Edit customer form sends (the same set the website's Customer form sends). */
export type CustomerInput = {
  prefix: string;
  firstName: string;
  lastName: string;
  customerCode: string;
  mobile: string;
  email: string;
  gst: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  birthdayMonth: string;
  birthdayDay: string;
  birthdayYear: string;
  architectId: string;
};

/** Add a customer; the server gives the SR No and starts it at the first stage, as on the website. */
export function createCustomer(input: CustomerInput & { createdById: string }) {
  return api<Customer>('/api/customers', { body: input });
}

/** Tick or untick the customer's current stage as done (anyone signed in, as on the website's Pipeline card). */
export function setStageDone(c: Pick<Customer, 'id' | 'stage' | 'completedStages'>, done: boolean) {
  const current = c.completedStages ?? [];
  const completedStages = done ? [...new Set([...current, c.stage])] : current.filter((s) => s !== c.stage);
  return api<Customer>(`/api/customers/${encodeURIComponent(c.id)}`, { method: 'PATCH', body: { completedStages } });
}

export function updateCustomer(id: string, fields: Partial<CustomerInput>) {
  return api<Customer>(`/api/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: fields });
}

/**
 * Move a customer to another stage, then add the "Stage changed to …" line to its Notes, exactly as the website's
 * Pipeline board does when a card is dragged.
 */
export async function changeStage(id: string, stage: string, stageLabel: string) {
  const updated = await api<Customer>(`/api/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: { stage } });
  // The stage is saved at this point; the Notes line is extra, so a failure there doesn't undo or hide the change.
  await api<unknown>(`/api/customers/${encodeURIComponent(id)}/messages`, { body: { kind: 'system', text: `Stage changed to ${stageLabel}` } }).catch(() => undefined);
  return updated;
}

/** The short architect form on the phone; the full record (site engineers, office...) stays on the website. */
export type ArchitectInput = { prefix: string; firstName: string; lastName: string; mobile: string; company: string };

export function createArchitect(input: ArchitectInput & Partial<ArchitectFields> & { createdById: string }) {
  return api<Architect>('/api/architects', { body: input });
}

/** The fields the phone's Architect Master form edits (partners and site engineers stay on the website). */
export type ArchitectFields = ArchitectInput & {
  office: string;
  instagram: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  birthdayMonth: string;
  birthdayDay: string;
  birthdayYear: string;
};

export function updateArchitect(id: string, fields: Partial<ArchitectFields>) {
  return api<Architect>(`/api/architects/${encodeURIComponent(id)}`, { method: 'PATCH', body: fields });
}

/** Remove an architect (super admin only; hidden as on the website). */
export function deleteArchitect(id: string) {
  return api<{ ok: boolean }>(`/api/architects/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Cities and States the website offers in its pickers (the Material library's "city" / "state" lists). */
export function listPlaces() {
  return api<{ id: string; category: string; name: string }[]>('/api/material-items').then((rows) => ({
    cities: rows.filter((r) => r.category === 'city').map((r) => r.name).sort((a, b) => a.localeCompare(b)),
    states: rows.filter((r) => r.category === 'state').map((r) => r.name).sort((a, b) => a.localeCompare(b)),
  }));
}

/** Remove a customer (super admin only; the server keeps the row hidden, as the website's delete). */
export function deleteCustomer(id: string) {
  return api<{ ok: boolean }>(`/api/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
