"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useOrgUsers } from "@/lib/store/users-store";
import { cn } from "@/lib/utils";

// A minimal searchable picker (Popover + filtered list) — no combobox
// component exists in this project yet, and this is a small enough need
// that pulling one in isn't worth it. Sources users live from users-store
// (backed by /api/users) so a freshly invited/created user is pickable
// without a hard refresh.
export function UserPicker({ value, onChange }: { value: string; onChange: (userId: string) => void }) {
  const users = useOrgUsers();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = users.find((u) => u.id === value);
  const results = users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex w-full items-center justify-between rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="bg-primary-transparent text-[10px] text-primary">
                {selected.name[0]}
              </AvatarFallback>
            </Avatar>
            {selected.name}
          </span>
        ) : (
          <span className="text-grey-400">Select assignee</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input
          autoFocus
          placeholder="Search team members"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2"
        />
        <div className="flex max-h-52 flex-col overflow-y-auto">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onChange(u.id);
                setOpen(false);
                setQuery("");
              }}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body hover:bg-light-600",
                u.id === value ? "text-primary" : "text-grey-800"
              )}
            >
              <span className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="bg-primary-transparent text-[10px] text-primary">
                    {u.name[0]}
                  </AvatarFallback>
                </Avatar>
                {u.name}
              </span>
              {u.id === value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
          {results.length === 0 && (
            <span className="px-2 py-1.5 text-sm font-body text-grey-400">No matches</span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
