"use client";

import { LiveClock } from "@/components/dashboard/live-clock";

type Stat = { label: string; value: string };

export function WelcomeBanner({ name, stats }: { name: string; stats: Stat[] }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-100 via-primary-200 to-secondary-100 shadow-sm">
      {/* Wave 1 */}
      <div
        className="absolute bottom-0 left-0 w-[200%] animate-wave-slow"
        style={{ height: "60px" }}
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 2880 80"
          preserveAspectRatio="none"
        >
          <path
            d="M0,30 C360,70 720,0 1080,40 C1260,60 1380,20 1440,30 C1800,70 2160,0 2520,40 C2700,60 2820,20 2880,30 L2880,80 L0,80 Z"
            fill="var(--color-primary-300)"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Wave 2 */}
      <div
        className="absolute bottom-0 left-0 w-[200%] animate-wave-fast"
        style={{ height: "50px" }}
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 2880 80"
          preserveAspectRatio="none"
        >
          <path
            d="M0,45 C320,15 640,65 960,35 C1200,15 1360,55 1440,45 C1760,15 2080,65 2400,35 C2640,15 2800,55 2880,45 L2880,80 L0,80 Z"
            fill="var(--color-secondary-300)"
            opacity="0.4"
          />
        </svg>
      </div>

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
