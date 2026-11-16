import { ProformaPackingPage } from "@/components/purchase-orders/proforma-packing-page";

// ?wo= picks one of the PI's Work Orders (Send to Work Order); without it, its first.
export default async function ProductionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ wo?: string }> }) {
  const { id } = await params;
  const { wo } = await searchParams;
  return <ProformaPackingPage id={id} mode="production" woId={wo} />;
}
