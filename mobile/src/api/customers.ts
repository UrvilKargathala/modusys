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

export type Architect = { id: string; prefix: string; firstName: string; lastName: string };
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
