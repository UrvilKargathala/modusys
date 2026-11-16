import { ProformaPackingPage } from "@/components/purchase-orders/proforma-packing-page";

// ?wo= packs one Production Work Order (its pieces with Quality Check ticked); without it, the whole Proforma Invoice (one from before Work Orders).
export default async function PackingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ wo?: string }> }) {
  const { id } = await params;
  const { wo } = await searchParams;
  return <ProformaPackingPage id={id} woId={wo} />;
}
