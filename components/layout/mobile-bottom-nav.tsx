"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { mobileTabItems, mobileMoreItems, administrationItems, canSeeNav } from "@/lib/nav";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useCurrentUser } from "@/lib/session";

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const currentUser = useCurrentUser();
  const visibleAdminItems = administrationItems.filter((item) => canSeeNav(item, currentUser.role));
  const visibleMoreItems = mobileMoreItems.filter((item) => canSeeNav(item, currentUser.role));

  const isMoreActive = [...mobileMoreItems, ...administrationItems].some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-grey-100 bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {mobileTabItems.filter((item) => canSeeNav(item, currentUser.role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-body transition-colors",
                active ? "text-primary" : "text-grey-400 hover:text-grey-700"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className={cn("max-w-full truncate px-1", active && "font-medium")}>
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-body transition-colors",
            isMoreActive ? "text-primary" : "text-grey-400 hover:text-grey-700"
          )}
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={isMoreActive ? 2.5 : 2} />
          <span className={cn("max-w-full truncate px-1", isMoreActive && "font-medium")}>More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-1 p-2">
            {visibleMoreItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-body font-medium transition-colors",
                    active ? "bg-primary-transparent text-primary" : "text-grey-700 hover:bg-light-600"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}

            <div className="my-1 border-t border-grey-100" />
            <span className="px-3 py-1 text-xs font-body font-medium uppercase tracking-wide text-grey-400">
              Admin
            </span>
            {visibleAdminItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-body font-medium transition-colors",
                    active ? "bg-primary-transparent text-primary" : "text-grey-700 hover:bg-light-600"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
