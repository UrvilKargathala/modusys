const miniBars = [40, 65, 50, 80, 60, 90];

export function AuthShowcasePanel() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-10 bg-gradient-to-br from-primary to-indigo px-12 py-10 lg:flex">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 font-heading text-xl font-bold text-white backdrop-blur">
          M
        </div>
        <h2 className="font-heading text-2xl font-semibold text-white">
          One Platform for Quotes, Customers &amp; Production
        </h2>
        <p className="text-sm font-body text-white/70">
          Track leads, price quotes, and manage your production pipeline —
          all from a single modular business platform.
        </p>
      </div>

      {/* Decorative dashboard preview — purely illustrative, not live data */}
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-heading text-sm font-semibold text-grey-900">
            Welcome back 👋
          </span>
          <div className="h-7 w-7 rounded-full bg-primary-transparent" />
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          {[
            { value: "74", label: "Customers" },
            { value: "41", label: "Quotes" },
            { value: "22%", label: "Conv. Rate" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-light-600 px-2 py-2.5 text-center">
              <div className="font-heading text-base font-bold text-grey-900">{stat.value}</div>
              <div className="text-[10px] font-body text-grey-400">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex h-20 items-end gap-1.5 rounded-lg bg-light-600 p-3">
          {miniBars.map((height, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-primary-500"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
