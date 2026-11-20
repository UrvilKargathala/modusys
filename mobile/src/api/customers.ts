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
  siteManagerId: string;
  createdById: string;
  createdAt: string;
};

export type Architect = { id: string; prefix: string; firstName: string; lastName: string; company?: string };
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

export function createArchitect(input: ArchitectInput & { createdById: string }) {
  return api<Architect>('/api/architects', { body: input });
}

/** Cities and States the website offers in its pickers (the Material library's "city" / "state" lists). */
export function listPlaces() {
  return api<{ id: string; category: string; name: string }[]>('/api/material-items').then((rows) => ({
    cities: rows.filter((r) => r.category === 'city').map((r) => r.name).sort((a, b) => a.localeCompare(b)),
    states: rows.filter((r) => r.category === 'state').map((r) => r.name).sort((a, b) => a.localeCompare(b)),
  }));
}
