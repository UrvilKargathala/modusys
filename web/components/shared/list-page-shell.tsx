import { cn } from "@/lib/utils";

type ListPageShellProps = {
  title: string;
  kpis?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
  pagination?: React.ReactNode;
  className?: string;
};

export function ListPageShell({
  title,
  kpis,
  filters,
  children,
  pagination,
  className,
}: ListPageShellProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <h1 className="text-2xl font-heading font-semibold text-grey-900">{title}</h1>
      {kpis && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{kpis}</div>}
      {filters && <div className="flex flex-wrap items-center justify-end gap-3">{filters}</div>}
      <div className="rounded-lg border border-grey-100 bg-card">{children}</div>
      {pagination && <div className="flex justify-end">{pagination}</div>}
    </div>
  );
}
