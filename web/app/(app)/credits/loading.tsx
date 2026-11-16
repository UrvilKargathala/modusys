import { Skeleton } from "@/components/ui/skeleton";

export default function CreditsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />

      {/* Balance card */}
      <div className="rounded-xl border border-grey-100 bg-white p-6 shadow-sm">
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="mb-4 h-10 w-40" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Transaction list */}
      <div className="rounded-xl border border-grey-100 bg-white shadow-sm">
        <div className="border-b border-grey-100 px-5 py-3">
          <Skeleton className="h-5 w-32" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-grey-100 px-5 py-4 last:border-0">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
