import { CustomersTable } from "@/components/customers/customers-table";

export default function CustomersPage() {
  return (
    // Pulls in most of the app shell's side padding (p-4 / lg:p-6): 4px left on each side, so the list gets the width.
    <div className="-mx-3 flex flex-col gap-6 lg:-mx-5">
      {/* Title keeps clear of the sidebar's collapse button. */}
      <div className="pl-4">
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Customer Master</h1>
        <p className="text-sm font-body text-grey-500">Manage your customer records.</p>
      </div>
      <CustomersTable />
    </div>
  );
}
