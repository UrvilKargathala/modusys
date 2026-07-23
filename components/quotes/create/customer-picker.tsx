"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { useCustomers, customersStore } from "@/lib/store/customers-store";
import { useProfileOverride } from "@/lib/store/customer-profile-overrides-store";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

// Same searchable-dropdown-with-inline-add pattern as MaterialReferenceSelect
// (components/templates/material-reference-select.tsx), cloned rather than
// reused since it's hardwired to Material Library — this one sources from
// Customers and opens the existing Add Customer modal instead.
export function CustomerPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const customers = useCustomers();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const selected = customers.find((c) => c.id === value);
  const results = customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary">
          {selected ? (
            <span className="min-w-0 truncate">{selected.name}</span>
          ) : (
            <span className="min-w-0 truncate text-grey-400">Select customer</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <Input autoFocus placeholder="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2" />
          <div className="flex max-h-52 flex-col overflow-y-auto">
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600",
                  c.id === value ? "text-primary" : "text-grey-800"
                )}
              >
                <span className="min-w-0 truncate">{c.name}</span>
                {c.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
            {results.length === 0 && <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAddOpen(true);
            }}
            className="mt-1 flex items-center gap-1.5 rounded-md border-t border-grey-100 px-2 py-2 text-left text-sm font-body font-medium text-primary hover:bg-light-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Add new customer
          </button>
        </PopoverContent>
      </Popover>

      <CustomerFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={async (values) => {
          const created = await customersStore.createCustomer({ ...values, createdById: getCurrentUser().id });
          onChange(created.id);
        }}
      />
    </>
  );
}

export function CustomerReadOnlyDetails({ customerId }: { customerId: string }) {
  const customers = useCustomers();
  const override = useProfileOverride(customerId);
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return null;

  const fields = [
    { label: "Address", value: override.area ?? customer.address },
    { label: "City", value: override.city ?? "—" },
    { label: "State", value: override.state ?? "—" },
    { label: "Postcode", value: override.postcode ?? "—" },
    { label: "Email", value: override.email ?? "—" },
    { label: "GST No.", value: override.gst ?? "—" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-grey-100 bg-light-600 p-3 sm:grid-cols-3">
      {fields.map((f) => (
        <div key={f.label} className="flex flex-col gap-0.5">
          <span className="text-xs font-body text-grey-400">{f.label}</span>
          <span className="truncate text-sm font-body text-grey-700">{f.value || "—"}</span>
        </div>
      ))}
    </div>
  );
}
