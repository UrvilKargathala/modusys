import { Skeleton } from "@/components/ui/skeleton";

export default function CrmLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-4 border-b border-grey-100 pb-2">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, col) => (
          <div key={col} className="flex flex-col gap-3">
            {/* Column header */}
            <div className="flex items-center justify-between rounded-lg bg-light-400 px-3 py-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            {/* Cards */}
            {Array.from({ length: 3 }).map((_, card) => (
              <div key={card} className="rounded-xl border border-grey-100 bg-white p-4 shadow-sm">
                <Skeleton className="mb-2 h-4 w-3/4" />
                <Skeleton className="mb-3 h-3 w-1/2" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
