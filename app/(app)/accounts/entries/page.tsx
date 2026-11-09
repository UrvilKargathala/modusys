import type { Prisma } from "@prisma/client";
import { getMasters, loadEntries, toDate } from "@/lib/server/accounts-data";
import { istDateString } from "@/lib/attendance-config";
import { ENTRY_TYPES, TYPE_LABEL, ddmmyyyy, pickRange } from "@/lib/accounts";
import { entrySheet } from "@/lib/accounts-export";
import { DatePicker } from "@/components/shared/date-picker";
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

  return (
    <>
      <PageHeader title="Account Entries" help={`${ddmmyyyy(from)} – ${ddmmyyyy(to)}. Cancelled entries stay listed, struck through, and leave every total.`}>
        <ExportButtons filename={`account-entries-${from}-to-${to}`} sheet="Entries" rows={entrySheet(rows)} />
        <EntryFormDialog />
      </PageHeader>

      <form className={FILTER_FORM}>
        <label className={FILTER_LABEL}>From<DatePicker key={from} name="from" mode="day" defaultValue={from} /></label>
        <label className={FILTER_LABEL}>To<DatePicker key={to} name="to" mode="day" defaultValue={to} /></label>
        <label className={FILTER_LABEL}>
          Type
          <select name="type" defaultValue={type} className={FILTER_SELECT}>
            <option value="">All types</option>
            {ENTRY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className={FILTER_LABEL}>
          Account Head
          <select name="head" defaultValue={sp.head ?? ""} className={FILTER_SELECT}>
            <option value="">All heads</option>
            {heads.map((h) => <option key={h.id} value={h.id}>{h.name} ({TYPE_LABEL[h.type]})</option>)}
          </select>
        </label>
        <label className={FILTER_LABEL}>
          Payment Account
          <select name="account" defaultValue={sp.account ?? ""} className={FILTER_SELECT}>
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className={FILTER_LABEL}>
          Status
          <select name="status" defaultValue={status} className={FILTER_SELECT}>
            <option value="">Posted and cancelled</option>
            <option value="posted">Posted only</option>
            <option value="cancelled">Cancelled only</option>
          </select>
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
