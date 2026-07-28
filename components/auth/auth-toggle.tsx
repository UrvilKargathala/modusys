"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Sign In", href: "/sign-in" },
  { label: "Sign Up", href: "/sign-up" },
];

export function AuthToggle() {
  const pathname = usePathname();

  return (
    <div className="relative flex rounded-full bg-light-600 p-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative z-10 flex-1 rounded-full px-4 py-2 text-center text-sm font-body font-semibold transition-colors",
              active
                ? "bg-teal text-grey-900 shadow-sm"
                : "text-grey-500 hover:text-grey-800"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
