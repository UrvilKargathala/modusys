// Plain helpers for the Customers screens: search, address and the contact links.
import type { Customer } from '../api/customers';

/** Case-insensitive match on name, mobile, customer code or city (the server's ?q= only searches names). */
export function matchesCustomer(c: Pick<Customer, 'name' | 'mobile' | 'customerCode' | 'city'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  return (
    c.name.toLowerCase().includes(q) ||
    c.customerCode.toLowerCase().includes(q) ||
    c.city.toLowerCase().includes(q) ||
    (digits.length >= 3 && c.mobile.replace(/\D/g, '').includes(digits))
  );
}

/** "12, Green Park, Adajan, Surat, Gujarat, 395009" (blank parts left out). */
export function fullAddress(c: Pick<Customer, 'address' | 'city' | 'state' | 'postcode'>): string {
  return [c.address, c.city, c.state, c.postcode].map((p) => p.trim()).filter(Boolean).join(', ');
}

/** WhatsApp chat link. A 10-digit Indian number gets the 91 country code. */
export function whatsappUrl(mobile: string): string | null {
  let digits = mobile.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

export function telUrl(mobile: string): string | null {
  const cleaned = mobile.replace(/[^\d+]/g, '');
  return cleaned.replace(/\D/g, '').length >= 6 ? `tel:${cleaned}` : null;
}

/** Google Maps search for the address (opens the Maps app where installed). */
export function mapsUrl(address: string): string | null {
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}
