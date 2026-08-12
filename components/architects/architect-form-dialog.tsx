"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { months } from "@/lib/constants/months";
import { mockUsers } from "@/lib/mock/users";
import type { Architect } from "@/lib/mock/architects";

const phonePattern = /^(\+91[\s-]?)?[6-9]\d{9}$/;

// Adult birth-year range for the Birthday selector (newest first).
const currentYear = new Date().getFullYear();
const birthYears = Array.from({ length: 70 }, (_, i) => String(currentYear - 18 - i));

const architectSchema = z.object({
  prefix: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  partners: z.array(z.object({ prefix: z.string(), firstName: z.string(), lastName: z.string() })),
  siteEngineers: z.array(z.object({ value: z.string() })),
  mobile: z.string().refine((v) => v === "" || phonePattern.test(v.replace(/\s/g, "")), {
    message: "Enter a valid 10-digit Indian mobile number",
  }),
  office: z.string().refine((v) => v === "" || phonePattern.test(v.replace(/\s/g, "")), {
    message: "Enter a valid 10-digit Indian office number",
  }),
  company: z.string(),
  instagram: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  postcode: z.string().refine((v) => v === "" || /^\d+$/.test(v), {
    message: "Postcode must be numeric",
  }),
  birthdayMonth: z.string(),
  birthdayDay: z.string(),
  birthdayYear: z.string(),
});

type ArchitectFormValues = z.infer<typeof architectSchema>;

function emptyValues(): ArchitectFormValues {
  return {
    prefix: "",
    firstName: "",
    lastName: "",
    partners: [],
    siteEngineers: [],
    mobile: "",
    office: "",
    company: "",
    instagram: "",
    address: "",
    city: "",
    state: "",
    postcode: "",
    birthdayMonth: "",
    birthdayDay: "",
    birthdayYear: "",
  };
}

function prefillValues(architect: Architect): ArchitectFormValues {
  return {
    prefix: architect.prefix,
    firstName: architect.firstName,
    lastName: architect.lastName,
    partners: architect.partners.map((p) => ({ prefix: p.prefix, firstName: p.firstName, lastName: p.lastName })),
    siteEngineers: architect.siteEngineers.map((value) => ({ value })),
    mobile: architect.mobile,
    office: architect.office,
    company: architect.company,
    instagram: architect.instagram,
    address: architect.address,
    city: architect.city,
    state: architect.state,
    postcode: architect.postcode,
    birthdayMonth: architect.birthdayMonth,
    birthdayDay: architect.birthdayDay,
    birthdayYear: architect.birthdayYear,
  };
}

export type ArchitectFormOutput = Omit<ArchitectFormValues, "partners" | "siteEngineers" | "instagram"> & {
  partners: { prefix: string; firstName: string; lastName: string }[];
  siteEngineers: string[];
  instagram: string;
};

export function ArchitectFormDialog({
  open,
  onOpenChange,
  architect,
  onSubmit,
  variant = "sheet",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent = Add mode; present = Edit mode, pre-filled from this record.
  architect?: Architect;
  onSubmit: (values: ArchitectFormOutput) => void;
  variant?: "sheet" | "dialog";
}) {
  const isEdit = !!architect;
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ArchitectFormValues>({
    resolver: zodResolver(architectSchema),
    mode: "onChange",
    defaultValues: emptyValues(),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "partners" });
  const engineers = useFieldArray({ control, name: "siteEngineers" });

  useEffect(() => {
    if (!open) return;
    reset(architect ? prefillValues(architect) : emptyValues());
  }, [open, architect, reset]);

  const submit = (values: ArchitectFormValues) => {
    onSubmit({
      ...values,
      partners: values.partners.filter((p) => p.firstName || p.lastName),
      siteEngineers: values.siteEngineers.map((s) => s.value).filter(Boolean),
      instagram: values.instagram && !values.instagram.startsWith("@") ? `@${values.instagram}` : values.instagram,
    });
    onOpenChange(false);
  };

  const createdBy = architect ? mockUsers.find((u) => u.id === architect.createdById)?.name : undefined;

  const title = isEdit ? "Edit Architect" : "Add Architect";
  const description = isEdit ? "Update this architect's details." : "Add a new architect contact.";
  const handleOpenChange = (next: boolean) => { if (!next) reset(emptyValues()); onOpenChange(next); };

  const body = (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-[6rem_1fr_1fr] gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-prefix">Prefix</Label>
              <Input id="a-prefix" placeholder="e.g. Mr" {...register("prefix")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-first">First Name *</Label>
              <Input id="a-first" placeholder="e.g. Kavita" {...register("firstName")} />
              {errors.firstName && <span className="text-xs font-body text-error">{errors.firstName.message}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-last">Last Name *</Label>
              <Input id="a-last" placeholder="e.g. Rao" {...register("lastName")} />
              {errors.lastName && <span className="text-xs font-body text-error">{errors.lastName.message}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Partner Name</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ prefix: "", firstName: "", lastName: "" })}>
                <Plus className="h-3.5 w-3.5" />
                Add Partner
              </Button>
            </div>
            {fields.length > 0 && (
              <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <div className="grid flex-1 grid-cols-[4.5rem_1fr_1fr] gap-2">
                      <Input
                        placeholder="Prefix"
                        {...register(`partners.${index}.prefix` as const)}
                      />
                      <Input
                        placeholder="First Name"
                        {...register(`partners.${index}.firstName` as const)}
                      />
                      <Input
                        placeholder="Last Name"
                        {...register(`partners.${index}.lastName` as const)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={`Remove partner ${index + 1}`}
                      className="shrink-0 rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-error"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Site Engineer Name</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => engineers.append({ value: "" })}>
                <Plus className="h-3.5 w-3.5" />
                Add Site Engineer
              </Button>
            </div>
            {engineers.fields.length > 0 && (
              <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                {engineers.fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      placeholder={`Site Engineer ${index + 1}`}
                      {...register(`siteEngineers.${index}.value` as const)}
                    />
                    <button
                      type="button"
                      onClick={() => engineers.remove(index)}
                      aria-label={`Remove site engineer ${index + 1}`}
                      className="shrink-0 rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-error"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-mobile">Mobile Number</Label>
              <Input id="a-mobile" placeholder="+91 98765 43210" className="font-number" {...register("mobile")} />
              {errors.mobile && <span className="text-xs font-body text-error">{errors.mobile.message}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-office">Office Number</Label>
              <Input id="a-office" placeholder="+91 22 2650 1122" className="font-number" {...register("office")} />
              {errors.office && <span className="text-xs font-body text-error">{errors.office.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-company">Company Name</Label>
              <Input id="a-company" {...register("company")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-instagram">Instagram ID</Label>
              <Input
                id="a-instagram"
                placeholder="@handle"
                {...register("instagram")}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v && !v.startsWith("@")) setValue("instagram", `@${v}`);
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-address">Address</Label>
            <Input id="a-address" placeholder="Street, area" {...register("address")} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-city">City</Label>
              <Input id="a-city" {...register("city")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-state">State</Label>
              <Input id="a-state" {...register("state")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-postcode">Postcode</Label>
              <Input id="a-postcode" className="font-number" {...register("postcode")} />
              {errors.postcode && <span className="text-xs font-body text-error">{errors.postcode.message}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Birthday</Label>
            <div className="grid grid-cols-3 gap-3">
              <select
                id="a-bday-day"
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
                id="a-bday-month"
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
                id="a-bday-year"
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

          {isEdit && (
            <p className="text-xs font-body text-grey-400">
              Added{" "}
              <span className="font-number">{architect &&
                new Date(architect.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}</span>
              {createdBy && ` by ${createdBy}`}
            </p>
          )}

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-2 flex flex-row justify-end gap-2 border-t border-grey-100 bg-popover px-6 py-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !isValid}>
          {isEdit ? "Save Changes" : "Add"}
        </Button>
      </div>
    </form>
  );

  if (variant === "dialog") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto p-6 sm:max-w-[520px]">
          <DialogHeader className="p-0">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-4 overflow-y-auto p-6 data-[side=right]:w-screen sm:data-[side=right]:w-full sm:data-[side=right]:max-w-[460px]"
      >
        <SheetHeader className="p-0">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}
