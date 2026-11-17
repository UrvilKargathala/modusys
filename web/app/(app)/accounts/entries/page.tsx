import type { Prisma } from "@prisma/client";
import { getMasters, loadEntries, toDate } from "@backend/server/accounts-data";
import { istDateString } from "@shared/attendance-config";
import { ENTRY_TYPES, TYPE_LABEL, ddmmyyyy, pickRange, totals } from "@shared/accounts";
import { entrySheet } from "@/lib/accounts-export";
import { DatePicker } from "@/components/shared/date-picker";
import { SelectField } from "@/components/shared/select-field";
import { Input } from "@/components/ui/input";
import { EntryFormDialog } from "@/components/accounts/entry-form-dialog";
import { EntriesTable } from "@/components/accounts/entries-table";
import { ExportButtons } from "@/components/accounts/export-buttons";
import { APPLY_BUTTON, FILTER_FORM, FILTER_LABEL, FILTER_SELECT, PageHeader } from "@/components/accounts/page-header";

export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string; type?: string; head?: string; account?: string; q?: string; status?: string };

// Every entry in a date range, filtered and searchable, with add / edit / cancel and Excel / Print.
export default async function AccountEntriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { from, to } = pickRange(sp, istDateString());
  const { heads, accounts } = await getMasters();
  const type = (ENTRY_TYPES as readonly string[]).includes(sp.type ?? "") ? sp.type! : "";
  const status = sp.status === "posted" || sp.status === "cancelled" ? sp.status : "";
  const q = (sp.q ?? "").trim();
  const and: Prisma.AccountEntryWhereInput[] = [{ date: { gte: toDate(from), lte: toDate(to) } }];
  if (type) and.push({ type });
  if (status) and.push({ status });
  if (sp.head) and.push({ headId: sp.head });
  if (sp.account) and.push({ OR: [{ accountId: sp.account }, { toAccountId: sp.account }] });
  if (q) and.push({ OR: [{ partyName: { contains: q, mode: "insensitive" } }, { remarks: { contains: q, mode: "insensitive" } }] });
  const rows = await loadEntries({ AND: and });
  // Totals of posted entries, for the PDF / Excel (the table shows its own).
  const t = totals(rows.filter((r) => r.status === "posted"));

  return (
    <>
      <PageHeader title="Account Entries" help={`${ddmmyyyy(from)} – ${ddmmyyyy(to)}. Cancelled entries stay listed, struck through, and leave every total.`}>
        <ExportButtons
          filename={`account-entries-${from}-to-${to}`}
          sheet="Entries"
          title="Account Entries"
          period={`${ddmmyyyy(from)} – ${ddmmyyyy(to)}`}
          filters={[
            type && `Type: ${TYPE_LABEL[type]}`,
            sp.head && `Account Head: ${heads.find((h) => h.id === sp.head)?.name ?? ""}`,
            sp.account && `Payment Account: ${accounts.find((a) => a.id === sp.account)?.name ?? ""}`,
            status && `Status: ${status === "posted" ? "Posted only" : "Cancelled only"}`,
            q && `Search: ${q}`,
          ].filter((f): f is string => !!f)}
          rows={entrySheet(rows)}
          summary={[["Income", t.income], ["Expense", t.expense], ["Net", t.net], ["Posted entries", String(t.count)]]}
        />
        <EntryFormDialog />
      </PageHeader>

      <form className={FILTER_FORM}>
        <label className={FILTER_LABEL}>From<DatePicker key={from} name="from" mode="day" defaultValue={from} /></label>
        <label className={FILTER_LABEL}>To<DatePicker key={to} name="to" mode="day" defaultValue={to} /></label>
        <label className={FILTER_LABEL}>
          Type
          <SelectField key={String(type)} name="type" defaultValue={type} className={FILTER_SELECT}>
            <option value="">All types</option>
            {ENTRY_TYPES.map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
          </SelectField>
        </label>
        <label className={FILTER_LABEL}>
          Account Head
          <SelectField key={String(sp.head ?? "")} name="head" defaultValue={sp.head ?? ""} className={FILTER_SELECT} menuClassName="w-80">
            <option value="">All heads</option>
            {heads.map((h) => <option key={h.id} value={h.id}>{h.name} ({TYPE_LABEL[h.type]})</option>)}
          </SelectField>
        </label>
        <label className={FILTER_LABEL}>
          Payment Account
          <SelectField key={String(sp.account ?? "")} name="account" defaultValue={sp.account ?? ""} className={FILTER_SELECT}>
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </SelectField>
        </label>
        <label className={FILTER_LABEL}>
          Status
          <SelectField key={String(status)} name="status" defaultValue={status} className={FILTER_SELECT}>
            <option value="">Posted and cancelled</option>
            <option value="posted">Posted only</option>
            <option value="cancelled">Cancelled only</option>
          </SelectField>
        </label>
        <label className={FILTER_LABEL}>
          Search
          <Input name="q" defaultValue={q} placeholder="Party or remarks" className="h-9 w-48" />
        </label>
        <button type="submit" className={APPLY_BUTTON}>Apply</button>
      </form>

      <EntriesTable rows={rows} />
    </>
  );
}
