"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { EditableField } from "@/components/crm/pipeline/customer-panel/editable-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { getCustomerProfile, getCustomerQuotes } from "@/lib/mock/customer-detail";
import { customersStore } from "@/lib/store/customers-store";
import type { Customer } from "@/lib/mock/pipeline";

// Profile-field keys (used by the editor UI) → the real Customer column
// they persist to. "area"/"phone" are legacy overlay names kept for the
// EditableField labels; everything else already matches 1:1.
const FIELD_MAP = {
  area: "address",
  city: "city",
  state: "state",
  postcode: "postcode",
  email: "email",
  phone: "mobile",
  gst: "gst",
} as const;

export function DetailsSection({ customer }: { customer: Customer }) {
  const profile = getCustomerProfile(customer);
  const quotes = getCustomerQuotes(customer);

  const save = (field: keyof typeof FIELD_MAP) => (value: string) =>
    customersStore.updateCustomer(customer.id, { [FIELD_MAP[field]]: value });

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EditableField label="Address" value={profile.area} onSave={save("area")} />
        <EditableField label="City" value={profile.city} onSave={save("city")} />
        <EditableField label="State" value={profile.state} onSave={save("state")} />
        <EditableField label="Postcode" value={profile.postcode} onSave={save("postcode")} numeric />
        <EditableField label="Email" value={profile.email} onSave={save("email")} />
        <EditableField label="Phone" value={profile.phone} onSave={save("phone")} numeric />
        <EditableField label="GST No" value={profile.gst} onSave={save("gst")} numeric />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-body text-grey-500">Birthday</span>
          <span className="text-sm font-body text-grey-900">
            {profile.birthdayMonth} <span className="font-number">{profile.birthdayDay}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-body text-grey-500">Architect</span>
        <span className="text-sm font-body text-grey-900">
          {profile.architectName ?? <span className="text-grey-300">Not associated</span>}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-body text-grey-500">Associated Quotes</span>
        {quotes.length === 0 ? (
          <span className="text-sm font-body text-grey-300">No quotes yet.</span>
        ) : (
          quotes.map((quote) => (
            <Link
              key={quote.id}
              href="/quotes"
              className="flex items-center justify-between gap-2 rounded-lg border border-grey-100 bg-light-600/60 px-3 py-2 transition-colors hover:bg-light-600"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-number font-medium text-grey-800">{quote.quoteNumber}</span>
                <span className="text-xs font-number text-grey-400">
                  {new Date(quote.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={quote.status} />
                <span className="text-sm font-number font-semibold text-grey-800">
                  ₹{quote.finalOfferLakh.toFixed(1)}L
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-grey-300" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
