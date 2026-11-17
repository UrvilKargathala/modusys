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
import { SelectField } from "@/components/shared/select-field";
import { toastStore } from "@/lib/store/toast-store";
import { ask } from "@/lib/store/ask-store";
import { uploadToStorage } from "@/lib/upload-to-storage";
import { istDateString } from "@shared/attendance-config";
import { formatInr } from "@/lib/format";
import { ENTRY_TYPES, PARTY_LABEL, TYPE_LABEL, entryNoLabel, entrySchema, type EntryInput, type EntryValues } from "@shared/accounts";
import type { EntryRow } from "@backend/server/accounts-data";
import { useMasters } from "./masters-context";

const SELECT = "h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const partyLabel = (name: string, type: string) => (type ? `${name} · ${PARTY_LABEL[type]}` : name);

// The merged "Account Head" pick is one value: h:<headId>, p:<partyType>:<partyId>, or n:<typed name>.
const headPick = (e?: EntryRow) =>
  !e ? "" : e.headId ? `h:${e.headId}` : e.partyType ? `p:${e.partyType}:${e.partyId}` : e.partyName ? `n:${e.partyName}` : "";

const toForm = (e?: EntryRow): EntryInput => ({
  date: e?.date ?? istDateString(),
  type: (e?.type as EntryInput["type"]) ?? "income",
  headId: e?.headId ?? "",
  accountId: e?.accountId ?? "",
  toAccountId: e?.toAccountId ?? "",
  amount: e ? String(e.amount) : "",
  paymentMode: e?.paymentMode ?? "",
  partyType: (e?.partyType as EntryInput["partyType"]) ?? "",
  partyId: e?.partyId ?? "",
  partyName: e?.partyName ?? "",
  remarks: e?.remarks ?? "",
  attachmentKey: "",
  attachmentName: "",
});

// Add or edit one entry: Entry No., Date, Type, Account Head (a head or a party), Bank/Cash, Amount, Mode, Remarks, Attachment.
export function EntryFormDialog({ entry }: { entry?: EntryRow }) {
  const router = useRouter();
  const { heads, accounts, modes, parties } = useMasters();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [typed, setTyped] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset, watch, setValue, trigger, formState: { errors, isSubmitting } } = useForm<EntryInput, unknown, EntryValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: toForm(entry),
  });
  useEffect(() => {
    if (!open) return;
    reset(toForm(entry));
    setPick(headPick(entry));
    setTyped(entry && !entry.headId && !entry.partyType && entry.partyName ? [entry.partyName] : []);
    setFile(null);
  }, [open, entry, reset]);

  const type = watch("type");
  const transfer = type === "transfer";
  // Active choices, plus whatever this entry already uses even if it has been deactivated since.
  const headOptions = heads.filter((h) => h.type === type && (h.isActive || h.id === entry?.headId));
  const modeOptions = [
    ...modes.filter((m) => m.isActive || m.name === entry?.paymentMode).map((m) => ({ name: m.name, isActive: m.isActive })),
    // The entry's own mode if it was renamed since: it stays pickable so an edit does not have to change it.
    ...(entry?.paymentMode && !modes.some((m) => m.name === entry.paymentMode) ? [{ name: entry.paymentMode, isActive: false }] : []),
  ];
  const accountOptions = accounts.filter((a) => a.isActive || a.id === entry?.accountId || a.id === entry?.toAccountId);
  const typedNames = [...new Set(typed)];

  // Picking a head or a party fills the form fields behind the one dropdown. An old entry that has both keeps its
  // party while its head stays picked, so editing it never drops data silently.
  const choose = (value: string) => {
    setPick(value);
    const keepParty = !!entry && value === headPick(entry) && value.startsWith("h:");
    const party = (t: string, id: string, name: string) => {
      setValue("partyType", t as EntryInput["partyType"]);
      setValue("partyId", id);
      setValue("partyName", name);
    };
    if (value.startsWith("h:")) {
      setValue("headId", value.slice(2), { shouldValidate: true });
      if (keepParty) party(entry.partyType, entry.partyId ?? "", entry.partyName);
      else party("", "", "");
      return;
    }
    setValue("headId", "");
    if (value.startsWith("p:")) {
      const [, t, id] = value.split(":");
      party(t, id, parties.find((p) => p.type === t && p.id === id)?.name ?? "");
    } else party("", "", value.slice(2));
    void trigger("headId");
  };
  const err = (k: keyof EntryInput) => (errors[k]?.message ? <p className="text-xs text-error">{String(errors[k]?.message)}</p> : null);

  const onSubmit = async (v: EntryValues) => {
    // A transfer has no head or party.
    const body: EntryValues = transfer ? { ...v, headId: "", partyType: "", partyId: "", partyName: "" } : v;
    const from = accounts.find((a) => a.id === v.accountId)?.name ?? "";
    const summary = transfer
      ? `${formatInr(v.amount)} from ${from} to ${accounts.find((a) => a.id === v.toAccountId)?.name ?? ""}`
      : `${TYPE_LABEL[v.type]} ${formatInr(v.amount)} · ${heads.find((h) => h.id === v.headId)?.name ?? partyLabel(v.partyName, v.partyType)} · ${from}`;
    if (!(await ask.confirm({ title: entry ? "Save changes to this entry?" : "Save this entry?", description: `${summary}\nDate ${v.date.split("-").reverse().join("/")}`, confirmLabel: entry ? "Save changes" : "Save entry" }))) return;
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="acc-type">Type *</Label>
                  <SelectField id="acc-type" value={type} className={SELECT}
                    onChange={(e) => {
                      const t = e.target.value as EntryInput["type"];
                      setValue("type", t, { shouldValidate: false });
                      // A head of the other type no longer fits; a party fits income and expense alike.
                      if (pick.startsWith("h:") && !heads.some((h) => h.id === pick.slice(2) && h.type === t)) choose("");
                    }}>
                    {ENTRY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </SelectField>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {!transfer && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="acc-head">Account Head *</Label>
                    <SelectField id="acc-head" value={pick} onChange={(e) => choose(e.target.value)} className={SELECT} menuClassName="w-80"
                      searchPlaceholder="Search heads, customers, vendors, dealers, employees"
                      onAdd={(name) => { setTyped((t) => [...t, name]); choose(`n:${name}`); }} addLabel="Type a name">
                      <option value="">Pick {type === "income" ? "an income" : "an expense"} head or a party</option>
                      {headOptions.map((h) => <option key={h.id} value={`h:${h.id}`}>{h.name}{h.isActive ? "" : " (inactive)"}</option>)}
                      {parties.map((p) => <option key={`${p.type}-${p.id}`} value={`p:${p.type}:${p.id}`}>{partyLabel(p.name, p.type)}</option>)}
                      {typedNames.map((n) => <option key={`n-${n}`} value={`n:${n}`}>{n}</option>)}
                    </SelectField>
                    {err("headId")}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="acc-account">{transfer ? "From account *" : "Bank/Cash *"}</Label>
                  <SelectField id="acc-account" value={watch("accountId")} onChange={(e) => setValue("accountId", e.target.value, { shouldValidate: true })} className={SELECT}>
                    <option value="">{transfer ? "Pick an account" : "Pick bank or cash"}</option>
                    {accountOptions.map((a) => <option key={a.id} value={a.id}>{a.name}{a.isActive ? "" : " (inactive)"}</option>)}
                  </SelectField>
                  {err("accountId")}
                </div>
                {transfer && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="acc-to">To account *</Label>
                    <SelectField id="acc-to" value={watch("toAccountId")} onChange={(e) => setValue("toAccountId", e.target.value, { shouldValidate: true })} className={SELECT}>
                      <option value="">Pick an account</option>
                      {accountOptions.map((a) => <option key={a.id} value={a.id}>{a.name}{a.isActive ? "" : " (inactive)"}</option>)}
                    </SelectField>
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
                  <SelectField id="acc-mode" value={watch("paymentMode")} onChange={(e) => setValue("paymentMode", e.target.value, { shouldValidate: true })} className={SELECT}>
                    <option value="">{transfer ? "—" : "Pick the mode"}</option>
                    {modeOptions.map((m) => <option key={m.name} value={m.name}>{m.name}{m.isActive ? "" : " (inactive)"}</option>)}
                  </SelectField>
                  {err("paymentMode")}
                </div>
              </div>

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
