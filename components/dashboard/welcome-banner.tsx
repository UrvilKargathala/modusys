import { LiveClock } from "@/components/dashboard/live-clock";

type Stat = { label: string; value: string };

export function WelcomeBanner({ name, stats }: { name: string; stats: Stat[] }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-100 via-primary-200 to-secondary-100 shadow-sm">
      {/* Animated wave */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        style={{ height: "40px" }}
      >
        <path
          d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z"
          fill="var(--color-primary-300)"
          opacity="0.25"
        >
          <animate
            attributeName="d"
            dur="6s"
            repeatCount="indefinite"
            values="
              M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z;
              M0,50 C360,10 720,70 1080,30 C1260,20 1380,40 1440,50 L1440,80 L0,80 Z;
              M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z
            "
          />
        </path>
        <path
          d="M0,50 C320,20 640,70 960,40 C1200,20 1360,50 1440,50 L1440,80 L0,80 Z"
          fill="var(--color-secondary-300)"
          opacity="0.2"
        >
          <animate
            attributeName="d"
            dur="8s"
            repeatCount="indefinite"
            values="
              M0,50 C320,20 640,70 960,40 C1200,20 1360,50 1440,50 L1440,80 L0,80 Z;
              M0,35 C320,65 640,25 960,55 C1200,65 1360,35 1440,35 L1440,80 L0,80 Z;
              M0,50 C320,20 640,70 960,40 C1200,20 1360,50 1440,50 L1440,80 L0,80 Z
            "
          />
        </path>
      </svg>

      <div className="relative z-10 flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-semibold text-grey-900">
            Welcome back, {name}
          </h2>
          <p className="text-sm font-body text-grey-500">
            Here&apos;s what&apos;s happening with your business today.
          </p>
          <LiveClock />
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
    </div>
  );
}
