"use client";

import { Info } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { getRole, type RoleKey } from "@shared/constants/roles";

export function RoleInfoPopover({ roleKey }: { roleKey: RoleKey | "" }) {
  const role = roleKey ? getRole(roleKey) : undefined;

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label="View role permissions"
        className="flex h-4 w-4 items-center justify-center rounded-full text-grey-300 transition-colors hover:text-primary"
      >
        <Info className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle className="font-heading">
            {role ? role.label : "Select a role"}
          </PopoverTitle>
        </PopoverHeader>
        {role ? (
          <ul className="flex flex-col gap-1.5">
            {role.permissions.map((perm) => (
              <li key={perm} className="text-xs font-body text-grey-500">
                • {perm}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs font-body text-grey-400">
            Pick a role to see what it can access.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
