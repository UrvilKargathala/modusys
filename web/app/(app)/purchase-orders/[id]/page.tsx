import { PurchaseOrderEditor } from "@/components/purchase-orders/purchase-order-editor";

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PurchaseOrderEditor id={id} />;
}
