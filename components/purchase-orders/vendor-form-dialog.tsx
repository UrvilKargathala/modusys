"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Vendor } from "@/lib/purchase-order";
import type { VendorInput } from "@/lib/store/vendors-store";

const gstPattern = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const schema = z.object({
  name: z.string().trim().min(1, "Vendor name is required"),
  code: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  gst: z.string().refine((v) => v === "" || gstPattern.test(v.trim().toUpperCase()), {
    message: "Enter a valid 15-character GST number",
  }),
  contacts: z.array(z.object({ name: z.string(), phone: z.string() })),
  // Field arrays need objects, so each email is { value }.
  emails: z.array(z.object({ value: z.string().trim().refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email") })),
});

type Values = z.infer<typeof schema>;

// Two email boxes to start (Email 1, Email 2); "+ Add Email" adds more.
const emailRows = (list: string[] = []) => [...list, "", ""].slice(0, Math.max(2, list.length)).map((value) => ({ value }));
const empty = (): Values => ({ name: "", code: "", address: "", city: "", state: "", gst: "", contacts: [{ name: "", phone: "" }], emails: emailRows() });

export function VendorFormDialog({
  open,
  onOpenChange,
  vendor,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent = Add mode; present = Edit mode.
  vendor?: Vendor;
  onSubmit: (values: VendorInput) => Promise<void> | void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: "onChange", defaultValues: empty() });
  const { fields, append, remove } = useFieldArray({ control, name: "contacts" });
  const emails = useFieldArray({ control, name: "emails" });

  useEffect(() => {
    if (!open) return;
    reset(
      vendor
        ? { ...vendor, code: vendor.code ?? "", contacts: vendor.contacts.length ? vendor.contacts : [{ name: "", phone: "" }], emails: emailRows(vendor.emails ?? []) }
        : empty()
    );
  }, [open, vendor, reset]);

  const submit = async (v: Values) => {
    await onSubmit({
      ...v,
      name: v.name.trim(),
      code: v.code.trim(),
      gst: v.gst.trim().toUpperCase(),
      contacts: v.contacts.filter((c) => c.name || c.phone),
      emails: v.emails.map((e) => e.value.trim()).filter(Boolean),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          <DialogDescription>
            {vendor ? "Update this vendor's details." : "Add a vendor purchase orders can be sent to."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-name">Vendor Name *</Label>
            <Input id="v-name" placeholder="e.g. Vishwakarma Furniture" {...register("name")} />
            {errors.name && <span className="text-xs font-body text-error">{errors.name.message}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-code">Vendor Code</Label>
            <Input id="v-code" placeholder="e.g. VEN-001" className="font-number" {...register("code")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-address">Address</Label>
            <Input id="v-address" {...register("address")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-city">City</Label>
              <Input id="v-city" {...register("city")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-state">State</Label>
              <Input id="v-state" placeholder="e.g. Maharashtra" {...register("state")} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-gst">GST Number</Label>
            <Input id="v-gst" placeholder="24AAZFT9177A1ZM" className="font-number uppercase" {...register("gst")} />
            {errors.gst && <span className="text-xs font-body text-error">{errors.gst.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Contacts</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", phone: "" })}>
                <Plus className="h-3.5 w-3.5" />
                Add Contact
              </Button>
            </div>
            {fields.map((field, i) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input placeholder="Contact name" {...register(`contacts.${i}.name` as const)} />
                <Input placeholder="Phone" className="font-number" {...register(`contacts.${i}.phone` as const)} />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove contact ${i + 1}`}
                  className="shrink-0 rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Emails</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => emails.append({ value: "" })}>
                <Plus className="h-3.5 w-3.5" />
                Add Email
              </Button>
            </div>
            {emails.fields.map((field, i) => (
              <div key={field.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Input type="email" placeholder={`Email ${i + 1}`} {...register(`emails.${i}.value` as const)} />
                  <button
                    type="button"
                    onClick={() => emails.remove(i)}
                    aria-label={`Remove email ${i + 1}`}
                    className="shrink-0 rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-error"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {errors.emails?.[i]?.value && <span className="text-xs font-body text-error">{errors.emails[i]?.value?.message}</span>}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {vendor ? "Save Changes" : "Add Vendor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
