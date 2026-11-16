import { ProformaPackingPage } from "@/components/purchase-orders/proforma-packing-page";

export default async function PackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProformaPackingPage id={id} />;
}
