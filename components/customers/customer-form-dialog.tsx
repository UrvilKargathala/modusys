"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { months } from "@/lib/constants/months";
import { mockUsers } from "@/lib/mock/users";
import type { Customer } from "@/lib/mock/pipeline";
import type { CustomerProfile } from "@/lib/mock/customer-detail";
import type { ProfileOverride } from "@/lib/store/customer-profile-overrides-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useArchitects, architectsStore } from "@/lib/store/architects-store";
import { fullName as architectFullName } from "@/lib/mock/architects";
import { ArchitectFormDialog } from "@/components/architects/architect-form-dialog";
import { CURRENT_USER_ID } from "@/lib/session";

const currentYear = new Date().getFullYear();
const birthYears = Array.from({ length: 70 }, (_, i) => String(currentYear - 18 - i));

function pad4(n: number) {
  return String(n).padStart(4, "0");
}
function deriveCode(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

const customerSchema = z.object({
  prefix: z.string(),
  firstName: z.string().min(1, "Name is required"),
  lastName: z.string(),
  mobile: z
    .string()
    .refine((v) => v === "" || /^(\+91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/\s/g, "")), {
      message: "Enter a valid 10-digit Indian mobile number",
    }),
  email: z.string().refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "Enter a valid email address",
  }),
  gst: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  postcode: z.string().refine((v) => v === "" || /^\d+$/.test(v), {
    message: "Postcode must be numeric",
  }),
  birthdayMonth: z.string(),
  birthdayDay: z.string(),
  birthdayYear: z.string(),
  architectId: z.string(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export type CustomerFormOutput = CustomerFormValues & { customerCode: string };

function emptyValues(): CustomerFormValues {
  return {
    prefix: "",
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    gst: "",
    address: "",
    city: "",
    state: "",
    postcode: "",
    birthdayMonth: "",
    birthdayDay: "",
    birthdayYear: "",
    architectId: "",
  };
}

function prefillValues(customer: Customer, profile: CustomerProfile, override: ProfileOverride): CustomerFormValues {
  const merged = { ...profile, ...override };
  return {
    prefix: customer.prefix ?? "",
    firstName: customer.firstName || customer.name,
    lastName: customer.lastName ?? "",
    mobile: merged.phone,
    email: merged.email,
    gst: merged.gst,
    address: merged.area,
    city: merged.city,
    state: merged.state,
    postcode: merged.postcode,
    birthdayMonth: merged.birthdayMonth,
    birthdayDay: merged.birthdayDay,
    birthdayYear: customer.birthdayYear ?? "",
    architectId: merged.architectId ?? "",
  };
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  profile,
  override,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent = Add mode; present = Edit mode, pre-filled from this record.
  customer?: Customer;
  profile?: CustomerProfile;
  override?: ProfileOverride;
  onSubmit: (values: CustomerFormOutput) => void;
}) {
  const isEdit = !!customer;
  const customers = useCustomers();
  const architects = useArchitects();
  const [addArchitectOpen, setAddArchitectOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    mode: "onChange",
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    reset(customer && profile ? prefillValues(customer, profile, override ?? {}) : emptyValues());
  }, [open, customer, profile, override, reset]);

  // SR No: the existing one in Edit mode, else a preview of the next serial
  // (the server assigns the authoritative value on save).
  const srNo = useMemo(() => {
    if (isEdit && customer) return customer.srNo || 0;
    return customers.reduce((max, c) => Math.max(max, c.srNo ?? 0), 0) + 1;
  }, [isEdit, customer, customers]);

  const liveCode = deriveCode(watch("firstName") ?? "", watch("lastName") ?? "");

  const submit = (values: CustomerFormValues) => {
    onSubmit({ ...values, customerCode: deriveCode(values.firstName, values.lastName) });
    onOpenChange(false);
  };

  const updatedBy = override?.updatedById ? mockUsers.find((u) => u.id === override.updatedById)?.name : undefined;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) reset(emptyValues()); onOpenChange(next); }}>
      <SheetContent
        side="right"
        className="flex flex-col gap-4 overflow-y-auto p-6 data-[side=right]:w-screen sm:data-[side=right]:w-full sm:data-[side=right]:max-w-[460px]"
      >
        <SheetHeader className="p-0">
          <SheetTitle>{isEdit ? "Edit Customer" : "Add Customer"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update this customer's details." : "Add a new customer to the pipeline."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-srno">SR No</Label>
                <div className="flex h-9 items-center justify-center rounded-lg border border-grey-100 bg-light-600 px-1 text-sm font-number font-medium text-grey-700">
                  {pad4(srNo)}{liveCode ? `-${liveCode}` : ""}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-code">Customer Code</Label>
                <div className="flex h-9 items-center justify-center rounded-lg border border-grey-100 bg-light-600 px-1 text-sm font-body font-medium text-grey-700">
                  {liveCode || "—"}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-prefix">Prefix</Label>
                <Input id="c-prefix" placeholder="e.g. Mr" {...register("prefix")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-first">Name *</Label>
                <Input id="c-first" placeholder="Rahul" {...register("firstName")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-last">Surname</Label>
                <Input id="c-last" placeholder="Verma" {...register("lastName")} />
              </div>
            </div>
            {errors.firstName && <span className="text-xs font-body text-error">{errors.firstName.message}</span>}
            <span className="text-xs font-body text-grey-400">Customer Code is auto-generated from the initials of Name and Surname.</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-mobile">Mobile Number</Label>
              <Input id="c-mobile" placeholder="+91 98765 43210" className="font-number" {...register("mobile")} />
              {errors.mobile && <span className="text-xs font-body text-error">{errors.mobile.message}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" placeholder="name@email.com" {...register("email")} />
              {errors.email && <span className="text-xs font-body text-error">{errors.email.message}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="c-architect">Architect Name</Label>
              <button
                type="button"
                onClick={() => setAddArchitectOpen(true)}
                className="text-xs font-body font-medium text-primary hover:underline"
              >
                + Add Architect
              </button>
            </div>
            <select
              id="c-architect"
              {...register("architectId")}
              className="h-9 w-full rounded-lg border border-grey-100 bg-card px-2.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
            >
              <option value="">Select an architect</option>
              {architects.map((a) => (
                <option key={a.id} value={a.id}>
                  {architectFullName(a)}{a.company ? ` — ${a.company}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-gst">GST No</Label>
            <Input id="c-gst" placeholder="22AAAAA0000A1Z5" className="font-number" {...register("gst")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-address">Address</Label>
            <Input id="c-address" placeholder="Street, area" {...register("address")} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-city">City</Label>
              <Input id="c-city" {...register("city")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-state">State</Label>
              <Input id="c-state" {...register("state")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-postcode">Postcode</Label>
              <Input id="c-postcode" className="font-number" {...register("postcode")} />
              {errors.postcode && (
                <span className="text-xs font-body text-error">{errors.postcode.message}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Birthday</Label>
            <div className="grid grid-cols-3 gap-3">
              <select
                id="c-bday-day"
                aria-label="Birthday day"
                {...register("birthdayDay")}
                className="h-9 w-full rounded-lg border border-grey-100 bg-card px-2.5 text-sm font-number text-grey-900 outline-none focus:border-primary"
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                id="c-bday-month"
                aria-label="Birthday month"
                {...register("birthdayMonth")}
                className="h-9 w-full rounded-lg border border-grey-100 bg-card px-2.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
              >
                <option value="">Month</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                id="c-bday-year"
                aria-label="Birthday year"
                {...register("birthdayYear")}
                className="h-9 w-full rounded-lg border border-grey-100 bg-card px-2.5 text-sm font-number text-grey-900 outline-none focus:border-primary"
              >
                <option value="">Year</option>
                {birthYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isEdit ? (
            override?.updatedAt && (
              <p className="text-xs font-body text-grey-400">
                Last updated{" "}
                <span className="font-number">{new Date(override.updatedAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}</span>
                {updatedBy && ` by ${updatedBy}`}
              </p>
            )
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-info-transparent px-3 py-2 text-sm font-body text-info">
              <Info className="h-4 w-4 shrink-0" />
              10 credits will be charged for adding this customer.
            </div>
          )}

          <SheetFooter className="gap-2 p-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid}>
              {isEdit ? "Save Changes" : "Add"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
      <ArchitectFormDialog
        variant="dialog"
        open={addArchitectOpen}
        onOpenChange={setAddArchitectOpen}
        onSubmit={async (values) => {
          const created = await architectsStore.createArchitect({ ...values, createdById: CURRENT_USER_ID });
          if (created?.id) setValue("architectId", created.id, { shouldValidate: true, shouldDirty: true });
        }}
      />
    </Sheet>
  );
}
