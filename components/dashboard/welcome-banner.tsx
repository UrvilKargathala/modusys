type Stat = { label: string; value: string };

export function WelcomeBanner({ name, stats }: { name: string; stats: Stat[] }) {
  return (
    <div className="flex flex-col items-start justify-between gap-6 rounded-xl bg-gradient-to-br from-light to-primary-100 p-6 md:flex-row md:items-center">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold text-grey-900">
          Welcome back, {name} 👋
        </h2>
        <p className="text-sm font-body text-grey-500">
          Here&apos;s what&apos;s happening with your business today.
        </p>
      </div>

      <div className="flex gap-8">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-start md:items-end">
            <span className="font-number text-2xl font-bold text-grey-900">{stat.value}</span>
            <span className="text-xs font-body text-grey-500">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
