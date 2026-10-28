"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastStore } from "@/lib/store/toast-store";
import { employeeSchema, type EmployeeInput, type EmployeeValues } from "@/lib/employee-schema";
import { WEEKDAYS, eachDate, monthRange } from "@/lib/payroll";
import { istDateString } from "@/lib/attendance-config";

export type EmployeeFormRow = {
  id: string;
  name: string;
  employeeNumber: string | null;
  department: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  requiredDailyMinutes: number | null;
  breakMinutes: number | null;
  lateGraceMinutes: number | null;
  weeklyOffDays: number[];
  observesHolidays: boolean;
  hourlyRate: number | null;
  monthlySalary: number | null;
  overtimeEnabled: boolean;
  overtimeMultiplier: number | null;
};

const toForm = (e?: EmployeeFormRow): EmployeeInput => ({
  name: e?.name ?? "",
  employeeNumber: e?.employeeNumber ?? "",
  department: e?.department ?? "",
  designation: e?.designation ?? "",
  email: e?.email ?? "",
  phone: e?.phone ?? "",
  scheduleStart: e?.scheduleStart ?? "",
  scheduleEnd: e?.scheduleEnd ?? "",
  requiredDailyHours: e?.requiredDailyMinutes != null ? +(e.requiredDailyMinutes / 60).toFixed(2) : ("" as unknown as number),
  breakMinutes: e?.breakMinutes ?? "",
  lateGraceMinutes: e?.lateGraceMinutes ?? "",
  weeklyOffDays: e?.weeklyOffDays ?? [],
  observesHolidays: e?.observesHolidays ?? true,
  hourlyRate: e?.hourlyRate ?? "",
  monthlySalary: e?.monthlySalary ?? "",
  overtimeEnabled: e?.overtimeEnabled ?? false,
  overtimeMultiplier: e?.overtimeMultiplier ?? "",
});

const SELECT = "h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-1.5 font-number text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const pad = (n: number) => String(n).padStart(2, "0");

// Hour / minute / AM-PM picker that reads and writes "HH:MM" (24-hour), so the time always shows as 10:00 AM whatever the browser locale.
export function TimeField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [h24, m] = value ? value.split(":").map(Number) : [NaN, 0];
  const hour = Number.isNaN(h24) ? "" : String(((h24 + 11) % 12) + 1);
  const pm = !Number.isNaN(h24) && h24 >= 12;
  const emit = (h: string, min: number, isPm: boolean) => h && onChange(`${pad((Number(h) % 12) + (isPm ? 12 : 0))}:${pad(min)}`);
  return (
    <div className="flex gap-1.5">
      <select id={id} aria-label="Hour" value={hour} onChange={(e) => emit(e.target.value, m, pm)} className={SELECT}>
        <option value="" disabled>Hour</option>
        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select>
      <select aria-label="Minute" value={m} onChange={(e) => emit(hour || "12", Number(e.target.value), pm)} className={SELECT}>
        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i * 5}>{pad(i * 5)}</option>)}
      </select>
      <select aria-label="AM or PM" value={pm ? "PM" : "AM"} onChange={(e) => emit(hour || "12", m, e.target.value === "PM")} className={SELECT}>
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
}

// Add or edit one employee: identity, working schedule (start, end, required hours, break, grace, weekly offs, holidays)
// and pay (hourly rate, overtime). Nothing is pre-filled for a new employee: a super admin enters every value.
export function EmployeeFormDialog({ employee }: { employee?: EmployeeFormRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<EmployeeInput, unknown, EmployeeValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: toForm(employee),
  });
  useEffect(() => {
    if (open) reset(toForm(employee));
  }, [open, employee, reset]);
  const offs = watch("weeklyOffDays") ?? [];
  const otOn = watch("overtimeEnabled");
  // With a monthly salary the hourly rate follows each month's working days (Sundays / weekly offs and holidays left out),
  // so full attendance pays the salary. Shown here for the current month; holidays bring the day count down further.
  const dayHours = Number(watch("requiredDailyHours")) || 0;
  const salary = Number(watch("monthlySalary")) || 0;
  const thisMonth = istDateString().slice(0, 7);
  const monthDays = eachDate(monthRange(thisMonth).from, monthRange(thisMonth).to).filter((d) => !offs.includes(new Date(`${d}T00:00:00Z`).getUTCDay())).length;
  const monthRate = salary && dayHours && monthDays ? salary / (monthDays * dayHours) : null;
  // Required hours follow end − start − break whenever one of those changes; the field stays editable for anything else.
  const recalcRequired = () => {
    const [s, e, b] = [getValues("scheduleStart"), getValues("scheduleEnd"), Number(getValues("breakMinutes")) || 0];
    if (!s || !e) return;
    const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const span = mins(e) - mins(s) - b;
    if (span > 0) setValue("requiredDailyHours", +(span / 60).toFixed(2), { shouldValidate: true });
  };
  const timeField = (k: "scheduleStart" | "scheduleEnd", label: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`emp-${k}`}>{label}</Label>
      <TimeField id={`emp-${k}`} value={watch(k) ?? ""} onChange={(v) => { setValue(k, v, { shouldValidate: true }); recalcRequired(); }} />
      {err(k)}
    </div>
  );

  const onSubmit = async (values: EmployeeValues) => {
    const res = await fetch(employee ? `/api/attendance/employees/${employee.id}` : "/api/attendance/employees", {
      method: employee ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return void toastStore.show(body.error ?? "Could not save the employee", "error");
    toastStore.show(employee ? "Employee updated" : "Employee added", "success");
    setOpen(false);
    router.refresh();
  };
  const err = (k: keyof EmployeeInput) => (errors[k]?.message ? <p className="text-xs text-error">{String(errors[k]?.message)}</p> : null);
  const field = (k: keyof EmployeeInput, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`emp-${k}`}>{label}</Label>
      <Input id={`emp-${k}`} {...register(k)} {...props} />
      {err(k)}
    </div>
  );

  return (
    <>
      {employee ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Edit ${employee.name}`} title="Edit" className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-primary">
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" /> Add Employee
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{employee ? `Edit ${employee.name}` : "Add Employee"}</DialogTitle>
            <DialogDescription>Schedule and hourly rate drive attendance, payable hours and salary for this employee only.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <section className="grid gap-3 sm:grid-cols-2">
              {field("name", "Name *")}
              {field("employeeNumber", "Employee ID *", { placeholder: "e.g. EMP-014" })}
              {field("department", "Department")}
              {field("designation", "Designation")}
              {field("email", "Email", { type: "email" })}
              {field("phone", "Phone")}
            </section>
            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-sm font-semibold text-grey-900">Working schedule</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {timeField("scheduleStart", "Start time *")}
                {timeField("scheduleEnd", "End time *")}
                {field("requiredDailyHours", "Required hours / day *", { type: "number", step: "0.25", min: "0", inputMode: "decimal", placeholder: "Auto from times" })}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emp-breakMinutes">Unpaid break (minutes)</Label>
                  <Input id="emp-breakMinutes" type="number" min="0" placeholder="0 = no break" {...register("breakMinutes", { onChange: recalcRequired })} />
                  {err("breakMinutes")}
                </div>
                {field("lateGraceMinutes", "Late grace (minutes)", { type: "number", min: "0", placeholder: "0 = late from start" })}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Weekly off days</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d, i) => {
                    const on = offs.includes(i);
                    return (
                      <button key={d} type="button" aria-pressed={on} onClick={() => setValue("weeklyOffDays", on ? offs.filter((x) => x !== i) : [...offs, i], { shouldValidate: true })}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-primary bg-primary-transparent text-primary" : "border-grey-200 text-grey-600 hover:bg-light-600"}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
                {err("weeklyOffDays")}
              </div>
              <label className="flex items-center gap-2 text-sm text-grey-700">
                <input type="checkbox" {...register("observesHolidays")} className="h-4 w-4 accent-primary" /> Company holidays are days off
              </label>
            </section>
            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-sm font-semibold text-grey-900">Pay</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emp-monthlySalary">Monthly salary (₹)</Label>
                  <Input id="emp-monthlySalary" type="number" min="0" step="1" inputMode="decimal" placeholder="Or set an hourly rate" {...register("monthlySalary")} />
                  {err("monthlySalary")}
                  {salary > 0 && (
                    <p className="text-[11px] text-grey-500">
                      {monthRate != null
                        ? <>{new Date(`${thisMonth}-01T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long" })}: {monthDays} days × {dayHours}h → <span className="font-number font-medium text-grey-900">₹{monthRate.toFixed(2)}/h</span>. Changes with each month&apos;s days.</>
                        : "Set the hours / day to work out the rate"}
                    </p>
                  )}
                </div>
                {/* Different keys: React mounts a fresh box when switching between the salary-made rate and a typed rate. */}
                {salary > 0 ? (
                  <div key="rate-from-salary" className="flex flex-col gap-1.5">
                    <Label>Hourly rate (₹)</Label>
                    <Input disabled value={monthRate != null ? monthRate.toFixed(2) : ""} placeholder="From salary" />
                    <p className="text-[11px] text-grey-500">From the salary, month by month</p>
                  </div>
                ) : <Fragment key="rate-typed">{field("hourlyRate", "Hourly rate (₹)", { type: "number", step: "0.01", min: "0", inputMode: "decimal", placeholder: "Or set a monthly salary" })}</Fragment>}
                {otOn && field("overtimeMultiplier", "Overtime rate × hourly", { type: "number", step: "0.05", min: "0", placeholder: "1 = same rate" })}
              </div>
              <label className="flex items-center gap-2 text-sm text-grey-700">
                <input type="checkbox" {...register("overtimeEnabled")} className="h-4 w-4 accent-primary" /> Pay approved overtime
              </label>
            </section>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : employee ? "Save changes" : "Add employee"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
