import { ProformaPackingPage } from "@/components/purchase-orders/proforma-packing-page";

// ?wo= opens one Production Work Order sent to Manufacturing; without it, the whole Proforma Invoice (one from before Work Orders).
export default async function ManufacturingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ wo?: string }> }) {
  const { id } = await params;
  const { wo } = await searchParams;
  return <ProformaPackingPage id={id} mode="manufacturing" woId={wo} />;
}
