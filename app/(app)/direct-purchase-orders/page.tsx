import { redirect } from "next/navigation";

// Direct Purchase Orders now live inside Purchase Orders (the Direct PO tab).
export default function DirectPurchaseOrdersPage() {
  redirect("/purchase-orders?tab=direct");
}
