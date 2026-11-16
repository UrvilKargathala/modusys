import { Construction } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-heading font-semibold text-grey-900">{title}</h1>
      <EmptyState icon={Construction} message={`${title} is coming in a later phase.`} />
    </div>
  );
}
