"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip, Pencil, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/shared/date-picker";
import { toastStore } from "@/lib/store/toast-store";
import { uploadToStorage } from "@/lib/upload-to-storage";
import { istDateString } from "@/lib/attendance-config";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ENTRY_TYPES, PARTY_LABEL, PAYMENT_MODES, TYPE_LABEL, entryNoLabel, entrySchema, type EntryInput, type EntryValues } from "@/lib/accounts";
import type { EntryRow } from "@/lib/server/accounts-data";
import { useMasters } from "./masters-context";

const SELECT = "h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const partyLabel = (name: string, type: string) => (type ? `${name} · ${PARTY_LABEL[type]}` : name);

const toForm = (e?: EntryRow): EntryInput => ({
  date: e?.date ?? istDateString(),
  type: (e?.type as EntryInput["type"]) ?? "income",
  headId: e?.headId ?? "",
  accountId: e?.accountId ?? "",
  toAccountId: e?.toAccountId ?? "",
  amount: e ? String(e.amount) : "",
  paymentMode: e?.paymentMode ?? "",
  partyType: "",
  partyId: "",
  partyName: "",
  remarks: e?.remarks ?? "",
  attachmentKey: "",
  attachmentName: "",
});

// Add or edit one entry, in the guide's order: Entry No., Date, Type, Head, Payment Account, Amount, Mode, Party, Remarks, Attachment.
export function EntryFormDialog({ entry }: { entry?: EntryRow }) {
  const router = useRouter();
  const { heads, accounts, parties } = useMasters();
  const [open, setOpen] = useState(false);
  const [party, setParty] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<EntryInput, unknown, EntryValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: toForm(entry),
  });
  useEffect(() => {
    if (!open) return;
    reset(toForm(entry));
    setParty(entry?.partyName ? partyLabel(entry.partyName, entry.partyType) : "");
    setFile(null);
  }, [open, entry, reset]);

  const type = watch("type");
  const transfer = type === "transfer";
  // Active choices, plus whatever this entry already uses even if it has been deactivated since.
  const headOptions = heads.filter((h) => h.type === type && (h.isActive || h.id === entry?.headId));
  const accountOptions = accounts.filter((a) => a.isActive || a.id === entry?.accountId || a.id === entry?.toAccountId);
  const err = (k: keyof EntryInput) => (errors[k]?.message ? <p className="text-xs text-error">{String(errors[k]?.message)}</p> : null);

  const onSubmit = async (v: EntryValues) => {
    // A picked party is "Name · Customer" from the list; anything else typed is kept as a plain name.
    const text = party.trim();
    const picked = parties.find((p) => partyLabel(p.name, p.type) === text);
    const body: EntryValues = { ...v, partyType: (picked?.type ?? "") as EntryValues["partyType"], partyId: picked?.id ?? "", partyName: picked?.name ?? text };
    const from = accounts.find((a) => a.id === v.accountId)?.name ?? "";
    const summary = transfer
      ? `${formatInr(v.amount)} from ${from} to ${accounts.find((a) => a.id === v.toAccountId)?.name ?? ""}`
      : `${TYPE_LABEL[v.type]} ${formatInr(v.amount)} · ${heads.find((h) => h.id === v.headId)?.name ?? ""} · ${from}`;
    if (!window.confirm(`${entry ? "Save changes to" : "Save"} this entry?\n\n${summary}\nDate ${v.date.split("-").reverse().join("/")}`)) return;
    if (file) {
      try {
        body.attachmentKey = await uploadToStorage("/api/accounts/presign", file);
        body.attachmentName = file.name;
      } catch {
        return void toastStore.show("Could not upload the attachment", "error");
      }
    }
    const res = await fetch(entry ? `/api/accounts/entries/${entry.id}` : "/api/accounts/entries", {
      method: entry ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return void toastStore.show(out.error ?? "Could not save the entry", "error");
    toastStore.show(entry ? "Entry updated" : `Entry ${out.entryNo} saved`, "success");
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      {entry ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Edit ${entryNoLabel(entry.entryNo)}`} title="Edit" className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-primary">
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add Entry
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{entry ? `Edit ${entryNoLabel(entry.entryNo)}` : "Add Entry"}</DialogTitle>
            <DialogDescription>Money received or paid. A move between your own accounts is a Transfer, not income or expense.</DialogDescription>
          </DialogHeader>
          {accounts.length === 0 ? (
            <p className="text-sm text-grey-600">Add a payment account (Office Cash, a bank account…) under Accounts → Payment Accounts first.</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Entry No.</Label>
                  <Input disabled value={entry ? entryNoLabel(entry.entryNo) : "Given on save"} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="acc-date">Date *</Label>
                  <DatePicker key={String(open)} id="acc-date" name="date" mode="day" defaultValue={watch("date")} onChange={(d) => setValue("date", d, { shouldValidate: true })} className="min-w-0" />
                  {err("date")}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Type *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ENTRY_TYPES.map((t) => (
                    <button key={t} type="button" aria-pressed={type === t}
                      onClick={() => {
                        setValue("type", t, { shouldValidate: false });
                        if (!heads.some((h) => h.id === watch("headId") && h.type === t)) setValue("headId", "");
                      }}
                      className={cn("h-9 rounded-lg border text-sm font-medium",
                        type === t ? (t === "income" ? "border-success bg-success-transparent text-success" : t === "expense" ? "border-error bg-error-transparent text-error" : "border-secondary bg-secondary-transparent text-secondary") : "border-grey-200 text-grey-600 hover:bg-light-600")}>
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {!transfer && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="acc-head">Account Head *</Label>
                    <select id="acc-head" {...register("headId")} className={SELECT}>
                      <option value="">Pick {type === "income" ? "an income" : "an expense"} head</option>
                      {headOptions.map((h) => <option key={h.id} value={h.id}>{h.name}{h.isActive ? "" : " (inactive)"}</option>)}
                    </select>
                    {err("headId")}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="acc-account">{transfer ? "From account *" : type === "income" ? "Received in *" : "Paid from *"}</Label>
                  <select id="acc-account" {...register("accountId")} className={SELECT}>
                    <option value="">Pick an account</option>
                    {accountOptions.map((a) => <option key={a.id} value={a.id}>{a.name}{a.isActive ? "" : " (inactive)"}</option>)}
                  </select>
                  {err("accountId")}
                </div>
                {transfer && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="acc-to">To account *</Label>
                    <select id="acc-to" {...register("toAccountId")} className={SELECT}>
                      <option value="">Pick an account</option>
                      {accountOptions.map((a) => <option key={a.id} value={a.id}>{a.name}{a.isActive ? "" : " (inactive)"}</option>)}
                    </select>
                    {err("toAccountId")}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="acc-amount">Amount (₹) *</Label>
                  <Input id="acc-amount" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" {...register("amount")} />
                  {err("amount")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="acc-mode">Payment Mode{transfer ? "" : " *"}</Label>
                  <select id="acc-mode" {...register("paymentMode")} className={SELECT}>
                    <option value="">{transfer ? "—" : "Pick the mode"}</option>
                    {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                  {err("paymentMode")}
                </div>
              </div>

              {!transfer && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="acc-party">Party / Person</Label>
                  <Input id="acc-party" list="acc-parties" value={party} onChange={(e) => setParty(e.target.value)} placeholder="Search customers, vendors, dealers, employees — or type a name" autoComplete="off" />
                  <datalist id="acc-parties">
                    {parties.map((p) => <option key={`${p.type}-${p.id}`} value={partyLabel(p.name, p.type)} />)}
                  </datalist>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="acc-remarks">Remarks</Label>
                <textarea id="acc-remarks" rows={2} {...register("remarks")} placeholder="Purpose, invoice number or reference" className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
                {err("remarks")}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="acc-file">Attachment</Label>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <input ref={fileRef} id="acc-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Paperclip className="h-3.5 w-3.5" /> {file || entry?.attachmentName ? "Replace" : "Choose file"}
                  </Button>
                  <span className="min-w-0 truncate text-grey-600">
                    {file ? file.name : entry?.attachmentName ? <a href={`/api/files/acc_${entry.id}`} target="_blank" rel="noreferrer" className="text-secondary underline">{entry.attachmentName}</a> : "Bill, receipt or payment proof (image or PDF, up to 10 MB)"}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : entry ? "Save changes" : "Save entry"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
