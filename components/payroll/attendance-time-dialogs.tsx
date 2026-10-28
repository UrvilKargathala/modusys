"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeField } from "@/components/payroll/employee-form-dialog";
import { toastStore } from "@/lib/store/toast-store";
import { istDateString } from "@/lib/attendance-config";

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) toastStore.show(j.error ?? "Something went wrong", "error");
  return res.ok;
}

type EditProps = { employeeId: string; name: string; date: string; checkIn: string; checkOut: string };

// Super admin: set or fix one day's check-in / check-out (IST), e.g. after an employee forgot to check out.
export function EditTimesDialog({ employeeId, name, date, checkIn, checkOut, open, onOpenChange }: EditProps & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [inT, setIn] = useState(checkIn);
  const [outT, setOut] = useState(checkOut);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setIn(checkIn); setOut(checkOut); setNote(""); }
  }, [open, checkIn, checkOut]);
  const save = async () => {
    setBusy(true);
    const ok = await send("/api/attendance/records", "PUT", { employeeId, date, checkIn: inT, checkOut: outT, note });
    setBusy(false);
    if (!ok) return;
    toastStore.show("Times saved", "success");
    onOpenChange(false);
    router.refresh();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Times for {name}</DialogTitle>
          <DialogDescription>{date.split("-").reverse().join("/")} · India time. Hours, late and early are worked out again from these.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fix-in">Check-in *</Label>
            <TimeField id="fix-in" value={inT} onChange={setIn} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="fix-out">Check-out</Label>
              {outT && <button type="button" onClick={() => setOut("")} className="text-xs text-grey-500 hover:text-error">Clear</button>}
            </div>
            <TimeField id="fix-out" value={outT} onChange={setOut} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fix-note">Reason</Label>
            <Input id="fix-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Forgot to check out, confirmed on call" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" disabled={busy || !inT} onClick={() => void save()}>{busy ? "Saving…" : "Save times"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditTimesButton({ label, ...props }: EditProps & { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" title="Edit check-in / check-out" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-secondary hover:bg-secondary-transparent">
        <Pencil className="h-3 w-3" />{label ?? "Edit"}
      </button>
      <EditTimesDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

// Employee: ask the super admins to fix a day's times. They get a notification that opens that day on the calendar.
export function RequestFixButton() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(istDateString());
  const [inT, setIn] = useState("");
  const [outT, setOut] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const ok = await send("/api/attendance/corrections", "POST", { date, checkIn: inT, checkOut: outT, note });
    setBusy(false);
    if (!ok) return;
    toastStore.show("Request sent to the admin", "success");
    setOpen(false);
  };
  return (
    <>
      <Button type="button" variant="outline" onClick={() => { setDate(istDateString()); setIn(""); setOut(""); setNote(""); setOpen(true); }}>
        <MessageSquareText className="h-4 w-4" /> Forgot to check in or out? Ask admin
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ask to fix a time</DialogTitle>
            <DialogDescription>The admin gets your message and sets the time for you. Fill only what needs fixing.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="req-date">Day *</Label>
              <Input id="req-date" type="date" value={date} max={istDateString()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="req-in">Check-in time</Label>
              <TimeField id="req-in" value={inT} onChange={setIn} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="req-out">Check-out time</Label>
              <TimeField id="req-out" value={outT} onChange={setOut} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="req-note">Message *</Label>
              <Input id="req-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Forgot to check out, left at 6:30 PM" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" disabled={busy || !date || (!inT && !outT) || note.trim().length < 3} onClick={() => void submit()}>{busy ? "Sending…" : "Send to admin"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
