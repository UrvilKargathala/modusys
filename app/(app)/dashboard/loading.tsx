import { Skeleton } from "@/components/ui/skeleton";

function SkeletonCard({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-grey-100 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Banner */}
      <Skeleton className="h-[120px] rounded-xl" />

      {/* Overview heading + date range */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-10 w-64 rounded-full" />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-28" />
              </div>
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Row 1: Pipeline + Donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2">
          <Skeleton className="mb-4 h-5 w-32" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="mb-4 h-5 w-24" />
          <Skeleton className="mx-auto h-[200px] w-[200px] rounded-full" />
        </SkeletonCard>
      </div>

      {/* Row 2: Trend chart + Top Customers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
          <Skeleton className="h-[260px] w-full rounded-lg" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="mb-4 h-5 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-3 flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </SkeletonCard>
      </div>

      {/* Row 3: 3 charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton className="mb-4 h-5 w-36" />
            <Skeleton className="h-[220px] w-full rounded-lg" />
          </SkeletonCard>
        ))}
      </div>

      {/* Row 4: Recent Quotes + Timeline + Tasks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton className="mb-4 h-5 w-32" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="mb-3 flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </SkeletonCard>
        ))}
      </div>

      {/* Row 5: Stale + Notifications + Birthdays */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Skeleton className="mb-4 h-5 w-28" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="mb-3 flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
