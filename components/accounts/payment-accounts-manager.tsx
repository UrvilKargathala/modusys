"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ACCOUNT_KINDS, ACCOUNT_KIND_LABEL } from "@/lib/accounts";
import type { AccountRow } from "@/lib/server/accounts-data";
import { useMasters } from "./masters-context";
import { send } from "./heads-manager";

const TH = "whitespace-nowrap px-3 py-2";

function AccountDialog({ account }: { account?: AccountRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("cash");
  const [opening, setOpening] = useState("");
  const [busy, setBusy] = useState(false);
  const show = () => {
    setName(account?.name ?? "");
    setKind(account?.kind ?? "cash");
    setOpening(account ? String(account.openingBalance) : "");
    setOpen(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const body = { name, kind, openingBalance: opening };
    const ok = account
      ? await send(`/api/accounts/payment-accounts/${account.id}`, "PATCH", body, "Account updated")
      : await send("/api/accounts/payment-accounts", "POST", body, `${name.trim()} added`);
    setBusy(false);
    if (ok) {
      setOpen(false);
      router.refresh();
    }
  };
  return (
    <>
      {account ? (
        <button type="button" onClick={show} title="Edit" aria-label={`Edit ${account.name}`} className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-primary">
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button type="button" onClick={show}><Plus className="h-4 w-4" /> Add Account</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{account ? `Edit ${account.name}` : "Add Payment Account"}</DialogTitle>
            <DialogDescription>Where money is received or paid: a cash box, a bank account, petty cash, a card.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pa-name">Name *</Label>
              <Input id="pa-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Current Account" maxLength={80} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pa-kind">Kind *</Label>
              <select id="pa-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm">
                {ACCOUNT_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pa-opening">Opening balance (₹)</Label>
              <Input id="pa-opening" type="number" step="0.01" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0.00" />
              <p className="text-[11px] text-grey-500">The balance before your first entry in this account. Don&apos;t also enter that money as income.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : account ? "Save changes" : "Add account"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Payment accounts with their opening and current balance. Deactivate instead of delete.
export function PaymentAccountsManager({ current }: { current: Record<string, number> }) {
  const router = useRouter();
  const { accounts } = useMasters();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><AccountDialog /></div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="bg-[var(--table-head)] text-xs font-body font-medium text-grey-900">
                {["Account", "Kind", "Opening Balance", "Current Balance", "Entries", ""].map((h, i) => (
                  <th key={h || i} className={cn(TH, (h.includes("Balance") || h === "Entries") && "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100 text-sm">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-light-600/50">
                  <td className={cn("px-3 py-2", !a.isActive && "text-grey-400 line-through")}>{a.name}</td>
                  <td className="px-3 py-2 text-grey-600">{ACCOUNT_KIND_LABEL[a.kind]}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-number">{formatInr(a.openingBalance)}</td>
                  <td className={cn("whitespace-nowrap px-3 py-2 text-right font-number font-semibold", (current[a.id] ?? 0) < 0 ? "text-error" : "text-grey-900")}>{formatInr(current[a.id] ?? a.openingBalance)}</td>
                  <td className="px-3 py-2 text-right font-number text-grey-500">{a.used}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      <AccountDialog account={a} />
                      <Button type="button" size="sm" variant="outline"
                        onClick={async () => {
                          if (await send(`/api/accounts/payment-accounts/${a.id}`, "PATCH", { isActive: !a.isActive }, a.isActive ? `${a.name} deactivated` : `${a.name} active again`)) router.refresh();
                        }}>
                        {a.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-grey-500">No payment accounts yet. Add Office Cash, Petty Cash and each bank account with its opening balance.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
