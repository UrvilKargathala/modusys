"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, KeyRound, UserRound, Download } from "lucide-react";
import { pwaInstallStore, usePwaInstall, isStandalone } from "@/lib/store/pwa-install-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GlobalSearch } from "@/components/layout/global-search";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { useNotificationRows } from "@/components/layout/use-notification-rows";
import { useCurrentUser, signOut } from "@/lib/session";
import { getRole } from "@/lib/constants/roles";


export function TopNavbar() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const roleLabel = currentUser.role === "no-role" ? "" : getRole(currentUser.role)?.label ?? currentUser.role;
  const { variant: pwaVariant } = usePwaInstall();

  const handleSignOut = async () => {
    await signOut();
    router.push("/sign-in");
  };
  const { rows: notificationRows, markAllRead } = useNotificationRows();

  return (
    <header className="flex h-16 items-center justify-between gap-4 lg:hidden border-b border-grey-100 bg-card px-4 md:px-6">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--avatar,#B08B8B)] font-heading text-sm font-bold text-white">
          M
        </div>
        <span className="hidden font-heading text-lg font-semibold text-grey-900 sm:inline">
          Modusys
        </span>
      </Link>


      <div className="flex shrink-0 items-center gap-2">
        <GlobalSearch />

        <NotificationPanel rows={notificationRows} onMarkAllRead={markAllRead} />

        {/* On desktop the account menu lives at the bottom of the sidebar. */}
        <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-light-600">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary-transparent text-primary">
                <UserRound className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-sm font-body font-medium text-grey-800">
                {currentUser.name || "Not signed in"}
              </span>
              <span className="text-xs font-body text-grey-400">{roleLabel}</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-grey-400 sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2.5 py-2 text-sm font-medium text-grey-700">
                {currentUser.name || "Not signed in"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {pwaVariant && !isStandalone() && (
                <DropdownMenuItem
                  onClick={() => pwaInstallStore.show()}
                  className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm"
                >
                  <Download className="h-4 w-4 shrink-0 text-grey-400" />
                  Install App
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                render={<Link href="/account/change-password" />}
                className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm"
              >
                <KeyRound className="h-4 w-4 shrink-0 text-grey-400" />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={handleSignOut}
                className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
