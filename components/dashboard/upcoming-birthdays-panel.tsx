"use client";

import { useMemo } from "react";
import { Cake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { useCustomers } from "@/lib/store/customers-store";
import { useArchitects } from "@/lib/store/architects-store";
import { fullName } from "@/lib/mock/architects";

// Customer/Architect store birthdayMonth as a full month name string
// ("March", "July"). Map back to a 0-11 index for date math.
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Row = { id: string; name: string; role: string; monthIdx: number; day: number; nextDate: Date };

function nextBirthday(monthIdx: number, day: number, today: Date): Date {
  const year = today.getFullYear();
  const thisYear = new Date(year, monthIdx, day);
  // If already past by more than a day, roll to next year.
  const startOfToday = new Date(year, today.getMonth(), today.getDate());
  return thisYear < startOfToday ? new Date(year + 1, monthIdx, day) : thisYear;
}

export function UpcomingBirthdaysPanel() {
  const customers = useCustomers();
  const architects = useArchitects();

  const rows: Row[] = useMemo(() => {
    const today = new Date();
    const merged: Row[] = [];
    for (const c of customers) {
      const m = MONTHS.indexOf(c.birthdayMonth ?? "");
      const d = Number(c.birthdayDay ?? "");
      if (m < 0 || !d || !c.name) continue;
      merged.push({ id: `c-${c.id}`, name: c.name, role: "Customer", monthIdx: m, day: d, nextDate: nextBirthday(m, d, today) });
    }
    for (const a of architects) {
      const m = MONTHS.indexOf(a.birthdayMonth ?? "");
      const d = Number(a.birthdayDay ?? "");
      const name = fullName(a);
      if (m < 0 || !d || !name) continue;
      merged.push({ id: `a-${a.id}`, name, role: "Architect", monthIdx: m, day: d, nextDate: nextBirthday(m, d, today) });
    }
    return merged.sort((x, y) => x.nextDate.getTime() - y.nextDate.getTime());
  }, [customers, architects]);

  return (
    <Card className="border-grey-100">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">Upcoming Birthdays</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={Cake}
            message="No birthdays on file yet. Add customers or architects with a birthday to see them here."
          />
        ) : (
          <ul className="scrollbar-hide flex max-h-80 flex-col divide-y divide-grey-100 overflow-y-auto">
            {rows.map((person) => {
              const dateLabel = `${String(person.day).padStart(2, "0")}/${String(person.monthIdx + 1).padStart(2, "0")}`;
              return (
                <li key={person.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-pink-transparent text-pink text-sm">
                      {person.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-body text-grey-800">{person.name}</span>
                    <span className="text-xs font-body text-grey-400">{person.role}</span>
                  </div>
                  <span className="text-xs font-number font-medium text-grey-500">{dateLabel}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
