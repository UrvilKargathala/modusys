import { VendorsTable } from "@/components/purchase-orders/vendors-table";

// The same list as Purchase Orders > Vendors, also reachable from Masters.
export default function VendorsPage() {
  return (
    // Pulls in most of the app shell's side padding (p-4 / lg:p-6): 4px left on each side, so the list gets the width.
    <div className="-mx-3 flex flex-col gap-6 lg:-mx-5">
      {/* Title keeps clear of the sidebar's collapse button. */}
      <div className="pl-4">
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Vendor Master</h1>
        <p className="text-sm font-body text-grey-500">Vendors purchase orders are sent to.</p>
      </div>
      <VendorsTable />
    </div>
  );
}
